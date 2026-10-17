// 中央カラム：ファイルビューア。行をクリックで選び「証拠に追加」で右カラムへ保存する
import { MAX_EVIDENCE, type GameState } from "../state";
import { fileKind, splitLines } from "../vfs";
import { h, icon } from "./dom";

const NUM = /^-?\d+(\.\d+)?$/;

export type ViewerHandlers = {
  onSelectLine: (line: number) => void;
  onAddEvidence: () => void;
};

/** Markdown は見出し・太字・コードだけ軽く装飾する */
function inlineMd(text: string): (Node | string)[] {
  const out: (Node | string)[] = [];
  const re = /\*\*(.+?)\*\*|`([^`]+)`/g;
  let last = 0;
  for (const m of text.matchAll(re)) {
    if (m.index! > last) out.push(text.slice(last, m.index));
    out.push(m[1] != null ? h("strong", null, m[1]) : h("code", null, m[2]));
    last = m.index! + m[0].length;
  }
  if (last < text.length) out.push(text.slice(last));
  return out;
}

function mdLine(text: string): HTMLElement {
  const m = text.match(/^(#{1,3})\s+(.*)$/);
  if (m) return h("span", { class: `md-h md-h${m[1].length}` }, m[1] + " ", ...inlineMd(m[2]));
  return h("span", null, ...inlineMd(text));
}

function addState(s: GameState): { disabled: boolean; reason: string } {
  if (s.selectedLine == null) return { disabled: true, reason: "行をクリックして選ぶと追加できます" };
  if (s.evidence.some((e) => e.file === s.activeFile && e.line === s.selectedLine))
    return { disabled: true, reason: "この行はもう証拠に入っています" };
  if (s.evidence.length >= MAX_EVIDENCE)
    return { disabled: true, reason: `証拠は${MAX_EVIDENCE}件までです。不要な証拠を削除してください` };
  return { disabled: false, reason: `${s.selectedLine}行目を選択中` };
}

function moveFocus(e: KeyboardEvent, row: HTMLElement, on: ViewerHandlers): void {
  const rows = [...(row.closest("[data-lines]")?.querySelectorAll<HTMLElement>("[data-line]") ?? [])];
  const i = rows.indexOf(row);
  const next = e.key === "ArrowDown" ? rows[i + 1] : e.key === "ArrowUp" ? rows[i - 1] : null;
  if (next) {
    e.preventDefault();
    on.onSelectLine(Number(next.dataset.line));
  } else if (e.key === "Enter" || e.key === " ") {
    e.preventDefault();
    if (row.getAttribute("aria-selected") === "true") on.onAddEvidence();
    else on.onSelectLine(Number(row.dataset.line));
  }
}

function lineAttrs(n: number, s: GameState, on: ViewerHandlers) {
  const selected = s.selectedLine === n;
  const saved = s.evidence.some((e) => e.file === s.activeFile && e.line === n);
  return {
    class: `line${selected ? " selected" : ""}${saved ? " saved" : ""}`,
    "data-line": String(n),
    role: "option",
    "aria-selected": String(selected),
    tabindex: selected || (s.selectedLine == null && n === 1) ? "0" : "-1",
    onclick: () => on.onSelectLine(n),
    ondblclick: () => on.onAddEvidence(),
    onkeydown: (e: KeyboardEvent) => moveFocus(e, e.currentTarget as HTMLElement, on),
  };
}

function renderBody(path: string, content: string, s: GameState, on: ViewerHandlers): HTMLElement {
  const lines = splitLines(content);
  const listAttrs = {
    "data-lines": "",
    role: "listbox",
    "aria-label": `${path} の行`,
  };
  if (fileKind(path) === "csv") {
    const cols = Math.max(...lines.map((l) => l.split(",").length));
    // 見出し以外の値がすべて数値の列は、見出しも右寄せにする
    const numericCol = Array.from({ length: cols }, (_, c) => {
      const vals = lines.slice(1).map((l) => l.split(",")[c] ?? "").filter((v) => v !== "");
      return vals.length > 0 && vals.every((v) => NUM.test(v));
    });
    return h(
      "div",
      { class: "csv", ...listAttrs },
      lines.map((l, i) => {
        const cells = l.split(",");
        while (cells.length < cols) cells.push("");
        return h(
          "div",
          { ...lineAttrs(i + 1, s, on), class: `${lineAttrs(i + 1, s, on).class} csv-row${i === 0 ? " csv-head" : ""}` },
          h("span", { class: "ln" }, i + 1),
          h(
            "span",
            { class: "csv-cells", style: `grid-template-columns:repeat(${cols}, minmax(0, 1fr))` },
            cells.map((c, ci) =>
              h("span", { class: `csv-cell${NUM.test(c) || (i === 0 && numericCol[ci]) ? " num" : ""}` }, c),
            ),
          ),
        );
      }),
    );
  }
  const md = fileKind(path) === "md";
  return h(
    "div",
    { class: "text", ...listAttrs },
    lines.map((l, i) =>
      h(
        "div",
        lineAttrs(i + 1, s, on),
        h("span", { class: "ln" }, i + 1),
        h("span", { class: "lt" }, md ? mdLine(l) : l || " "),
      ),
    ),
  );
}

export function renderViewer(s: GameState, on: ViewerHandlers): HTMLElement {
  if (!s.activeFile) {
    return h(
      "section",
      { class: "viewer", "aria-label": "ファイルビューア" },
      h(
        "div",
        { class: "viewer-empty" },
        icon("folder_open", "big"),
        h("p", null, "左のツリーからファイルを開いてください"),
        h("p", { class: "muted" }, "根拠にしたい行を選んで「証拠に追加」すると、右の成果物で使えます"),
      ),
    );
  }
  const st = addState(s);
  const parts = s.activeFile.split("/");
  return h(
    "section",
    { class: "viewer", "aria-label": "ファイルビューア" },
    h(
      "div",
      { class: "viewer-tabs" },
      h(
        "div",
        { class: "viewer-tab" },
        icon(fileKind(s.activeFile) === "csv" ? "table_chart" : "description", "sm"),
        parts[parts.length - 1],
      ),
    ),
    h(
      "div",
      { class: "viewer-bar" },
      h(
        "div",
        { class: "crumbs" },
        ["WORKSPACE", ...parts].flatMap((p, i) => [
          i > 0 ? icon("chevron_right", "xs") : null,
          h("span", null, p),
        ]),
      ),
      h(
        "div",
        { class: "viewer-action" },
        h("span", { class: "muted small", id: "add-reason" }, st.reason),
        h(
          "button",
          {
            class: "btn btn-accent",
            disabled: st.disabled,
            "aria-describedby": "add-reason",
            onclick: () => on.onAddEvidence(),
          },
          icon("bookmark_add", "sm"),
          "証拠に追加",
        ),
      ),
    ),
    h("div", { class: "viewer-body" }, renderBody(s.activeFile, s.files[s.activeFile], s, on)),
  );
}
