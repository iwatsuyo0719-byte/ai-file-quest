// ステージ内の一時状態（保存しない）。リトライ時は createState で作り直す
import { extractNumbers, formatNumber, isBlank } from "./normalize";
import type { AnswerKey, CardForm, FillForm, FillSlot, LineRef, Stage, Submission } from "./types";
import { fileKind, splitLines } from "./vfs";

export const MAX_EVIDENCE = 10;

export type Evidence = { id: string; file: string; line: number; text: string };

export type Card = {
  id: string;
  kind: "label" | "value";
  text: string;
  /** 証拠から作った値カードだけが持つ出典 */
  source: LineRef | null;
};

export type Cell = { label: string | null; value: string | null };

export type GameState = {
  stage: Stage;
  files: Record<string, string>;
  openDirs: Set<string>;
  activeFile: string | null;
  selectedLine: number | null;
  history: string[];
  evidence: Evidence[];
  fill: Record<string, { value: string; evidenceId: string | null }>;
  cells: Cell[];
  selectedCard: string | null;
  hintsUsed: number;
  seq: number;
};

export function createState(stage: Stage, files: Record<string, string>): GameState {
  const fill: GameState["fill"] = {};
  const cells: Cell[] = [];
  if (stage.answerMode === "fill") {
    for (const s of (stage.form as FillForm).slots) fill[s.id] = { value: "", evidenceId: null };
  } else {
    for (let i = 0; i < (stage.form as CardForm).rows; i++) cells.push({ label: null, value: null });
  }
  return {
    stage,
    files,
    openDirs: new Set([""]),
    activeFile: null,
    selectedLine: null,
    history: [],
    evidence: [],
    fill,
    cells,
    selectedCard: null,
    hintsUsed: 0,
    seq: 0,
  };
}

export function toggleDir(s: GameState, path: string): void {
  if (s.openDirs.has(path)) s.openDirs.delete(path);
  else s.openDirs.add(path);
}

/** ファイルを開く。表示中のファイルを再度クリックしただけでは履歴に数えない */
export function openFile(s: GameState, path: string): void {
  if (!(path in s.files) || s.activeFile === path) return;
  s.activeFile = path;
  s.selectedLine = null;
  s.history.push(path);
}

export function selectLine(s: GameState, line: number | null): void {
  s.selectedLine = line;
}

export type AddEvidenceResult = "added" | "noSelection" | "duplicate" | "full";

export function addEvidence(s: GameState): AddEvidenceResult {
  if (!s.activeFile || s.selectedLine == null) return "noSelection";
  const file = s.activeFile;
  const line = s.selectedLine;
  if (s.evidence.some((e) => e.file === file && e.line === line)) return "duplicate";
  if (s.evidence.length >= MAX_EVIDENCE) return "full";
  const text = splitLines(s.files[file])[line - 1] ?? "";
  s.evidence.push({ id: `ev${++s.seq}`, file, line, text });
  return "added";
}

export function removeEvidence(s: GameState, id: string): void {
  s.evidence = s.evidence.filter((e) => e.id !== id);
  for (const f of Object.values(s.fill)) if (f.evidenceId === id) f.evidenceId = null;
  // その証拠から作った値カードは表から外す
  for (const c of s.cells) if (c.value?.startsWith(`${id}:`)) c.value = null;
  if (s.selectedCard?.startsWith(`${id}:`)) s.selectedCard = null;
}

export function setFillValue(s: GameState, slot: string, value: string): void {
  if (s.fill[slot]) s.fill[slot].value = value;
}

export function setFillEvidence(s: GameState, slot: string, evidenceId: string | null): void {
  if (s.fill[slot]) s.fill[slot].evidenceId = evidenceId;
}

export function openNextHint(s: GameState): void {
  if (s.hintsUsed < s.stage.hints.length) s.hintsUsed++;
}

// ---------- カード配置 ----------

export function labelCards(form: CardForm): Card[] {
  return form.labelCards.map((text, i) => ({ id: `label:${i}`, kind: "label", text, source: null }));
}

export function candidateCards(form: CardForm): Card[] {
  return form.candidateCards.map((text, i) => ({ id: `cand:${i}`, kind: "value", text, source: null }));
}

/** 証拠の行に含まれる数値を、1つずつ値カードにする（日付は除く） */
export function evidenceCards(evidence: Evidence[]): Card[] {
  return evidence.flatMap((e) =>
    extractNumbers(e.text, fileKind(e.file) === "csv").map((n, i) => ({
      id: `${e.id}:${i}`,
      kind: "value" as const,
      text: formatNumber(n),
      source: { file: e.file, line: e.line },
    })),
  );
}

export function allCards(s: GameState): Card[] {
  const form = s.stage.form as CardForm;
  return [...labelCards(form), ...evidenceCards(s.evidence), ...candidateCards(form)];
}

export function placedCardIds(s: GameState): Set<string> {
  const ids = new Set<string>();
  for (const c of s.cells) {
    if (c.label) ids.add(c.label);
    if (c.value) ids.add(c.value);
  }
  return ids;
}

/** カードを選ぶ（置いてあるカードは選べない）。同じカードをもう一度押すと選択解除 */
export function selectCard(s: GameState, id: string | null): void {
  if (id && placedCardIds(s).has(id)) return;
  s.selectedCard = s.selectedCard === id ? null : id;
}

/**
 * セルをクリック：カードを選んでいれば置く（置いてあったカードは置き場へ戻る）。
 * 何も選んでいなければ、置いてあるカードを置き場へ戻す。種類の違うカードは置けない
 */
export function clickCell(s: GameState, row: number, col: "label" | "value"): boolean {
  const cell = s.cells[row];
  if (!cell) return false;
  if (!s.selectedCard) {
    if (!cell[col]) return false;
    cell[col] = null;
    return true;
  }
  const card = allCards(s).find((c) => c.id === s.selectedCard);
  if (!card || (card.kind === "label") !== (col === "label")) return false;
  cell[col] = card.id;
  s.selectedCard = null;
  return true;
}

// ---------- 提出 ----------

/** 値は入力したのに根拠を選んでいない欄（穴埋めのみ）。提出は止めず、注意だけ出す */
export function slotsMissingEvidence(s: GameState): FillSlot[] {
  if (s.stage.answerMode !== "fill") return [];
  return (s.stage.form as FillForm).slots.filter(
    (slot) => slot.evidence && !isBlank(s.fill[slot.id]?.value) && !s.fill[slot.id]?.evidenceId,
  );
}

export function canSubmit(s: GameState): boolean {
  if (s.stage.answerMode === "fill") return Object.values(s.fill).every((f) => !isBlank(f.value));
  return s.cells.some((c) => c.label || c.value);
}

export function toSubmission(s: GameState, key: AnswerKey): Submission {
  const base = { history: [...s.history], hintsUsed: s.hintsUsed };
  if (s.stage.answerMode === "fill") {
    const answers: Submission["answers"] = {};
    let filled = 0;
    for (const [slot, f] of Object.entries(s.fill)) {
      const ev = s.evidence.find((e) => e.id === f.evidenceId);
      answers[slot] = { value: f.value, evidence: ev ? { file: ev.file, line: ev.line } : null };
      if (!isBlank(f.value)) filled++;
    }
    return { ...base, answers, rowOrder: null, filled, total: Object.keys(s.fill).length };
  }
  const cards = new Map(allCards(s).map((c) => [c.id, c]));
  const labelSlots = key.labelSlots ?? {};
  const answers: Submission["answers"] = {};
  const rowOrder: (string | null)[] = [];
  let filled = 0;
  for (const cell of s.cells) {
    const label = cell.label ? cards.get(cell.label) : undefined;
    const value = cell.value ? cards.get(cell.value) : undefined;
    if (label) filled++;
    if (value) filled++;
    const slot = label ? (labelSlots[label.text] ?? null) : null;
    rowOrder.push(slot);
    if (slot && value && !answers[slot]) answers[slot] = { value: value.text, evidence: value.source };
  }
  return { ...base, answers, rowOrder, filled, total: s.cells.length * 2 };
}
