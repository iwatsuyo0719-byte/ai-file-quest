import { getFiles, getStage } from "../src/stages";
import {
  addEvidence,
  allCards,
  clickCell,
  createState,
  type GameState,
  openFile,
  selectCard,
  selectLine,
} from "../src/state";
import type { AnswerKey, StageId } from "../src/types";
import stage01Key from "../stages/stage01/answer.json";
import stage02Key from "../stages/stage02/answer.json";
import stage03Key from "../stages/stage03/answer.json";

export const KEYS = {
  stage01: stage01Key as AnswerKey,
  stage02: stage02Key as AnswerKey,
  stage03: stage03Key as AnswerKey,
} satisfies Record<StageId, AnswerKey>;

export function newGame(id: StageId): GameState {
  return createState(getStage(id), getFiles(id));
}

/** ファイルを開いて行を選び、証拠に追加する。追加した証拠IDを返す */
export function collect(s: GameState, file: string, line: number): string {
  openFile(s, file);
  selectLine(s, line);
  const r = addEvidence(s);
  if (r !== "added") throw new Error(`addEvidence ${file}:${line} -> ${r}`);
  return s.evidence[s.evidence.length - 1].id;
}

/** 文字でカードを探して、指定の行・列に置く */
export function place(s: GameState, text: string, row: number, col: "label" | "value"): void {
  const card = allCards(s).find((c) => c.text === text && ![...s.cells].some((x) => x[col] === c.id));
  if (!card) throw new Error(`card not found: ${text}`);
  selectCard(s, card.id);
  if (!clickCell(s, row, col)) throw new Error(`cannot place ${text} at ${row}/${col}`);
}
