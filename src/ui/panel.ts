// 右カラム：チャット依頼・ステージ条件・証拠・成果物・ヒント・提出
import {
  allCards,
  canSubmit,
  type Card,
  MAX_EVIDENCE,
  placedCardIds,
  type GameState,
} from "../state";
import type { CardForm, FillForm, FillSlot } from "../types";
import { h, icon } from "./dom";

export type PanelHandlers = {
  onRemoveEvidence: (id: string) => void;
  onJumpEvidence: (id: string) => void;
  onFillValue: (slot: string, value: string) => void;
  onFillEvidence: (slot: string, evidenceId: string | null) => void;
  onSelectCard: (id: string) => void;
  onClickCell: (row: number, col: "label" | "value") => void;
  onHint: () => void;
  onSubmit: () => void;
};

function evidenceLabel(s: GameState, id: string): string {
  const i = s.evidence.findIndex((e) => e.id === id);
  const e = s.evidence[i];
  return e ? `#${i + 1} ${e.file}:${e.line}` : "";
}

function renderRequest(s: GameState): HTMLElement {
  return h(
    "section",
    { class: "chat", "aria-label": "依頼" },
    h(
      "div",
      { class: "msg msg-user" },
      h("div", { class: "msg-who" }, icon("person", "xs"), "ユーザー"),
      h("p", { class: "msg-body" }, s.stage.request),
    ),
    h(
      "div",
      { class: "msg msg-system" },
      h("div", { class: "msg-who" }, icon("rule", "xs"), "ステージ条件"),
      h("ul", { class: "conditions" }, s.stage.conditions.map((c) => h("li", null, c))),
      h("p", { class: "muted small" }, `基準日：${s.stage.baseDate}`),
    ),
  );
}

function renderEvidence(s: GameState, on: PanelHandlers): HTMLElement {
  return h(
    "section",
    { class: "block", "aria-labelledby": "ev-title" },
    h(
      "h2",
      { class: "block-title", id: "ev-title" },
      icon("bookmarks", "sm"),
      "証拠",
      h("span", { class: "count" }, `${s.evidence.length} / ${MAX_EVIDENCE}`),
    ),
    s.evidence.length === 0
      ? h(
          "p",
          { class: "empty" },
          "まだありません。ファイルの行を選んで「証拠に追加」すると、ここに出典付きで保存されます。",
        )
      : h(
          "ol",
          { class: "evidence" },
          s.evidence.map((e, i) =>
            h(
              "li",
              { class: "ev" },
              h(
                "button",
                { class: "ev-main", title: "このファイルを開く", onclick: () => on.onJumpEvidence(e.id) },
                h("span", { class: "ev-src" }, `#${i + 1} ${e.file}:${e.line}`),
                h("span", { class: "ev-text" }, e.text || "（空行）"),
              ),
              h(
                "button",
                {
                  class: "icon-btn",
                  "aria-label": `証拠 #${i + 1} を削除`,
                  title: "削除",
                  onclick: () => on.onRemoveEvidence(e.id),
                },
                icon("close", "sm"),
              ),
            ),
          ),
        ),
  );
}

function slotInput(s: GameState, slot: FillSlot, on: PanelHandlers): HTMLElement {
  const id = `slot-${slot.id}`;
  const current = s.fill[slot.id]?.value ?? "";
  if (slot.input === "text") {
    return h(
      "div",
      { class: "input-wrap" },
      h("input", {
        id,
        class: "input",
        type: "text",
        inputmode: "numeric",
        autocomplete: "off",
        placeholder: slot.placeholder ?? "",
        value: current,
        oninput: (e: Event) => on.onFillValue(slot.id, (e.target as HTMLInputElement).value),
      }),
      slot.suffix ? h("span", { class: "suffix" }, slot.suffix) : null,
    );
  }
  const options = slot.input === "file" ? Object.keys(s.files).sort() : (slot.options ?? []);
  const sel = h(
    "select",
    { id, class: "input", onchange: (e: Event) => on.onFillValue(slot.id, (e.target as HTMLSelectElement).value) },
    h("option", { value: "" }, "選択してください"),
    options.map((o) => h("option", { value: o }, o)),
  );
  sel.value = current;
  return sel;
}

function renderFill(s: GameState, form: FillForm, on: PanelHandlers): HTMLElement {
  return h(
    "div",
    { class: "fill" },
    form.slots.map((slot) => {
      const evId = `slot-${slot.id}-ev`;
      const evSel = slot.evidence
        ? h(
            "select",
            {
              id: evId,
              class: "input input-sm",
              onchange: (e: Event) => on.onFillEvidence(slot.id, (e.target as HTMLSelectElement).value || null),
            },
            h("option", { value: "" }, s.evidence.length ? "根拠を選ぶ" : "根拠なし（先に証拠を追加）"),
            s.evidence.map((e) => h("option", { value: e.id }, evidenceLabel(s, e.id))),
          )
        : null;
      if (evSel) evSel.value = s.fill[slot.id]?.evidenceId ?? "";
      return h(
        "div",
        { class: "slot" },
        h("label", { class: "slot-label", for: `slot-${slot.id}` }, slot.label),
        slotInput(s, slot, on),
        evSel
          ? h("div", { class: "slot-ev" }, h("label", { class: "muted small", for: evId }, "根拠"), evSel)
          : null,
      );
    }),
    h("p", { class: "muted small" }, "数値は全角・半角、カンマの有無どちらでも構いません。"),
  );
}

function cardButton(card: Card, s: GameState, placed: Set<string>, on: PanelHandlers): HTMLElement {
  const used = placed.has(card.id);
  const selected = s.selectedCard === card.id;
  return h(
    "button",
    {
      class: `card card-${card.kind}${selected ? " selected" : ""}${card.source ? " from-ev" : ""}`,
      "aria-pressed": String(selected),
      disabled: used,
      title: card.source ? `出典：${card.source.file}:${card.source.line}` : used ? "表に置いてあります" : "",
      onclick: () => on.onSelectCard(card.id),
    },
    card.source ? icon("bookmark", "xs") : null,
    card.text,
  );
}

function renderCards(s: GameState, form: CardForm, on: PanelHandlers): HTMLElement {
  const cards = allCards(s);
  const byId = new Map(cards.map((c) => [c.id, c]));
  const placed = placedCardIds(s);
  const labels = cards.filter((c) => c.kind === "label");
  const evValues = cards.filter((c) => c.kind === "value" && c.source);
  const candidates = cards.filter((c) => c.kind === "value" && !c.source);
  const selected = s.selectedCard ? byId.get(s.selectedCard) : undefined;
  const cell = (row: number, col: "label" | "value") => {
    const id = s.cells[row][col];
    const card = id ? byId.get(id) : undefined;
    const target = !!selected && (selected.kind === "label") === (col === "label");
    return h(
      "td",
      null,
      h(
        "button",
        {
          class: `cell${card ? " filled" : ""}${target ? " target" : ""}`,
          "aria-label": `${row + 1}行目の${col === "label" ? form.columns[0] : form.columns[1]}${card ? `：${card.text}（クリックで外す）` : "：空き"}`,
          onclick: () => on.onClickCell(row, col),
        },
        card ? card.text : h("span", { class: "muted" }, "空き"),
      ),
    );
  };
  return h(
    "div",
    { class: "cards" },
    h(
      "table",
      { class: "card-table" },
      h("thead", null, h("tr", null, h("th", null, form.columns[0]), h("th", null, form.columns[1]))),
      h(
        "tbody",
        null,
        s.cells.map((_, row) => h("tr", null, cell(row, "label"), cell(row, "value"))),
      ),
    ),
    h(
      "p",
      { class: "muted small" },
      selected
        ? `「${selected.text}」を置くセルを選んでください（もう一度カードを押すと取り消し）`
        : "カードを選んでから、表のセルを押して置きます。置いたカードはセルを押すと外れます。",
    ),
    h("div", { class: "card-group-title" }, "ラベルカード"),
    h("div", { class: "card-pool" }, labels.map((c) => cardButton(c, s, placed, on))),
    h("div", { class: "card-group-title" }, "値カード（証拠から）"),
    evValues.length
      ? h("div", { class: "card-pool" }, evValues.map((c) => cardButton(c, s, placed, on)))
      : h("p", { class: "empty" }, "証拠に追加した行の数値が、ここに値カードとして出ます。"),
    h("div", { class: "card-group-title" }, "値カード（計算の候補）"),
    h("div", { class: "card-pool" }, candidates.map((c) => cardButton(c, s, placed, on))),
  );
}

function renderDeliverable(s: GameState, on: PanelHandlers): HTMLElement {
  const fill = s.stage.answerMode === "fill";
  return h(
    "section",
    { class: "block", "aria-labelledby": "out-title" },
    h(
      "h2",
      { class: "block-title", id: "out-title" },
      icon(fill ? "edit_note" : "table_view", "sm"),
      fill ? "成果物（穴埋め）" : "成果物（カード配置）",
    ),
    fill ? renderFill(s, s.stage.form as FillForm, on) : renderCards(s, s.stage.form as CardForm, on),
  );
}

function renderHints(s: GameState, on: PanelHandlers): HTMLElement {
  const n = s.hintsUsed;
  const total = s.stage.hints.length;
  const nextPenalty = s.stage.hintPenalties[n] ?? 0;
  return h(
    "section",
    { class: "block", "aria-labelledby": "hint-title" },
    h("h2", { class: "block-title", id: "hint-title" }, icon("lightbulb", "sm"), "ヒント", h("span", { class: "count" }, `${n} / ${total}`)),
    n > 0
      ? h(
          "ol",
          { class: "hints" },
          s.stage.hints.slice(0, n).map((t, i) =>
            h("li", null, h("span", { class: "hint-step" }, ["考え方", "探す場所", "具体的な手順"][i]), t),
          ),
        )
      : null,
    n < total
      ? h(
          "button",
          { class: "btn btn-ghost", onclick: () => on.onHint() },
          icon("lightbulb", "sm"),
          `ヒント${n + 1}を見る`,
          h("span", { class: "muted small" }, nextPenalty ? `（−${nextPenalty}点）` : "（減点なし）"),
        )
      : h("p", { class: "muted small" }, "ヒントはすべて開きました。"),
  );
}

function renderComposer(s: GameState, on: PanelHandlers): HTMLElement {
  const ok = canSubmit(s);
  const reason = ok
    ? "提出すると採点されます。提出後は変更できません。"
    : s.stage.answerMode === "fill"
      ? "すべての欄を入力すると提出できます"
      : "表にカードを1枚以上置くと提出できます";
  return h(
    "div",
    { class: "composer" },
    h("p", { class: "muted small", id: "submit-reason" }, reason),
    h(
      "button",
      { class: "btn btn-accent btn-submit", disabled: !ok, "aria-describedby": "submit-reason", onclick: () => on.onSubmit() },
      icon("arrow_upward", "sm"),
      "成果物を提出",
    ),
  );
}

export function renderPanel(s: GameState, on: PanelHandlers): HTMLElement {
  return h(
    "aside",
    { class: "panel", "aria-label": "依頼と成果物" },
    h(
      "div",
      { class: "panel-scroll" },
      renderRequest(s),
      renderEvidence(s, on),
      renderDeliverable(s, on),
      renderHints(s, on),
    ),
    renderComposer(s, on),
  );
}

/** 入力中に再描画せず、提出ボタンだけ更新する */
export function updateComposer(root: HTMLElement, s: GameState, on: PanelHandlers): void {
  root.querySelector(".composer")?.replaceWith(renderComposer(s, on));
}
