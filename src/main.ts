// 起動・画面切替（タイトル → ゲーム → 結果）
import "./styles/tokens.css";
import "./styles/app.css";
import { applyResult, loadSave, writeSave, type Loaded } from "./save";
import { score } from "./scoring";
import { getFiles, getStage, loadAnswerKey, nextStage, STAGES } from "./stages";
import {
  addEvidence,
  clickCell,
  createState,
  type GameState,
  openFile,
  openNextHint,
  removeEvidence,
  selectCard,
  selectLine,
  setFillEvidence,
  setFillValue,
  toSubmission,
  toggleDir,
} from "./state";
import type { StageId } from "./types";
import { clear, h, icon } from "./ui/dom";
import { renderPanel, updateComposer, type PanelHandlers } from "./ui/panel";
import { renderResult } from "./ui/result";
import { renderTitle } from "./ui/title";
import { renderTree } from "./ui/tree";
import { renderViewer } from "./ui/viewer";
import { buildTree } from "./vfs";

const app = document.getElementById("app")!;
let loaded: Loaded = loadSave(localStorage);

function hasProgress(s: GameState): boolean {
  return (
    s.history.length > 0 ||
    s.evidence.length > 0 ||
    s.hintsUsed > 0 ||
    Object.values(s.fill).some((f) => f.value) ||
    s.cells.some((c) => c.label || c.value)
  );
}

function showTitle(): void {
  document.title = "AI FILE QUEST";
  clear(app, renderTitle(STAGES, loaded.save, startStage));
  window.scrollTo(0, 0);
}

function startStage(id: StageId): void {
  if (!loaded.save.unlocked.includes(id)) return showTitle();
  const stage = getStage(id);
  const files = getFiles(id);
  const s = createState(stage, files);
  const tree = buildTree(files);
  document.title = `Stage ${String(stage.number).padStart(2, "0")} ${stage.title}｜AI FILE QUEST`;

  const confirmLeave = (msg: string) => !hasProgress(s) || window.confirm(msg);

  const header = h(
    "header",
    { class: "topbar" },
    h("span", { class: "brand" }, icon("terminal", "sm"), "AI FILE QUEST"),
    h("span", { class: "sep" }, "/"),
    h("span", { class: "stage-label" }, `Stage ${String(stage.number).padStart(2, "0")}｜${stage.title}`),
    h("span", { class: "spacer" }),
    h(
      "button",
      {
        class: "btn btn-ghost btn-sm",
        onclick: () => {
          if (confirmLeave("閲覧履歴・証拠・回答・ヒントをすべて初期化して、最初からやり直しますか？")) startStage(id);
        },
      },
      icon("restart_alt", "sm"),
      "リトライ",
    ),
    h(
      "button",
      {
        class: "btn btn-ghost btn-sm",
        onclick: () => {
          if (confirmLeave("このステージの途中経過は保存されません。ステージ選択に戻りますか？")) showTitle();
        },
      },
      icon("grid_view", "sm"),
      "ステージ選択",
    ),
  );
  const treeCol = h("div", { class: "col col-tree" });
  const viewerCol = h("div", { class: "col col-viewer" });
  const panelCol = h("div", { class: "col col-panel" });
  clear(app, header, h("div", { class: "game" }, treeCol, viewerCol, panelCol));

  const refresh = () => {
    const focusKey = focusSnapshot();
    const vScroll = viewerCol.querySelector(".viewer-body")?.scrollTop ?? 0;
    const pScroll = panelCol.querySelector(".panel-scroll")?.scrollTop ?? 0;
    clear(treeCol, renderTree(tree, s, treeOn));
    clear(viewerCol, renderViewer(s, viewerOn));
    clear(panelCol, renderPanel(s, panelOn));
    const vb = viewerCol.querySelector(".viewer-body");
    if (vb) vb.scrollTop = vScroll;
    const ps = panelCol.querySelector(".panel-scroll");
    if (ps) ps.scrollTop = pScroll;
    restoreFocus(focusKey);
  };

  const treeOn = {
    onToggle: (p: string) => {
      toggleDir(s, p);
      refresh();
    },
    onOpen: (p: string) => {
      const changed = s.activeFile !== p;
      openFile(s, p);
      refresh();
      if (changed) viewerCol.querySelector(".viewer-body")?.scrollTo(0, 0);
    },
  };
  const viewerOn = {
    onSelectLine: (n: number) => {
      selectLine(s, n);
      refresh();
      viewerCol.querySelector<HTMLElement>(`[data-line="${n}"]`)?.focus();
    },
    onAddEvidence: () => {
      if (addEvidence(s) === "added") {
        refresh();
        flash(panelCol.querySelector(".evidence li:last-child"));
      }
    },
  };
  const panelOn: PanelHandlers = {
    onRemoveEvidence: (evId) => {
      removeEvidence(s, evId);
      refresh();
    },
    onJumpEvidence: (evId) => {
      const e = s.evidence.find((x) => x.id === evId);
      if (!e) return;
      // 証拠から開き直すのも「表示」として履歴に数える
      openFile(s, e.file);
      openParents(s, e.file);
      selectLine(s, e.line);
      refresh();
      viewerCol.querySelector<HTMLElement>(`[data-line="${e.line}"]`)?.scrollIntoView({ block: "center" });
    },
    onFillValue: (slot, v) => {
      setFillValue(s, slot, v);
      updateComposer(panelCol, s, panelOn);
    },
    onFillEvidence: (slot, evId) => {
      setFillEvidence(s, slot, evId);
      updateComposer(panelCol, s, panelOn);
    },
    onSelectCard: (cardId) => {
      selectCard(s, cardId);
      refresh();
    },
    onClickCell: (row, col) => {
      if (clickCell(s, row, col)) refresh();
    },
    onHint: () => {
      openNextHint(s);
      refresh();
    },
    onSubmit: () => void submit(s),
  };
  refresh();
}

function openParents(s: GameState, path: string): void {
  const parts = path.split("/");
  for (let i = 1; i < parts.length; i++) s.openDirs.add(parts.slice(0, i).join("/"));
}

type FocusKey = { sel: string } | null;

function focusSnapshot(): FocusKey {
  const el = document.activeElement as HTMLElement | null;
  if (!el || el === document.body) return null;
  if (el.dataset.path != null) return { sel: `[data-path="${el.dataset.path}"]` };
  if (el.dataset.line != null) return { sel: `[data-line="${el.dataset.line}"]` };
  if (el.getAttribute("aria-label")) return { sel: `[aria-label="${el.getAttribute("aria-label")}"]` };
  return null;
}

function restoreFocus(k: FocusKey): void {
  if (!k) return;
  try {
    app.querySelector<HTMLElement>(k.sel)?.focus({ preventScroll: true });
  } catch {
    // セレクタにできない文字が入っていた場合は諦める
  }
}

function flash(el: Element | null): void {
  if (!el) return;
  el.classList.add("flash");
  el.scrollIntoView({ block: "nearest" });
  setTimeout(() => el.classList.remove("flash"), 900);
}

async function submit(s: GameState): Promise<void> {
  const id = s.stage.id;
  const key = await loadAnswerKey(id);
  const result = score(s.stage, key, toSubmission(s, key), s.files);
  const prevBest = loaded.save.best[id]?.score;
  const next = nextStage(id);
  const save = applyResult(loaded.save, id, result, next);
  writeSave(localStorage, save, loaded);
  loaded = { save, corrupt: false, raw: null };
  const isNewBest = result.rank !== "—" && (prevBest == null || result.total > prevBest);
  clear(
    app,
    renderResult(s.stage, key, result, s.history, isNewBest, {
      onRetry: () => startStage(id),
      onNext: next && save.unlocked.includes(next) ? () => startStage(next) : null,
      onTitle: showTitle,
    }),
  );
  window.scrollTo(0, 0);
}

showTitle();
