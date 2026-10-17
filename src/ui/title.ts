// タイトル（ステージ選択）：解放・ロック・最高点・ランク
import type { Save } from "../save";
import type { Stage, StageId } from "../types";
import { h, icon } from "./dom";

export function renderTitle(stages: Stage[], save: Save, onStart: (id: StageId) => void): HTMLElement {
  return h(
    "main",
    { class: "title" },
    h(
      "div",
      { class: "title-inner" },
      h("p", { class: "eyebrow" }, icon("terminal", "sm"), "AGENT SIMULATION"),
      h("h1", { class: "logo" }, "AI FILE QUEST"),
      h(
        "p",
        { class: "lead" },
        "あなたはAIエージェントです。ユーザーの依頼を受け、フォルダのファイルを開いて読み、指示を守って成果物を提出してください。",
      ),
      h(
        "ol",
        { class: "how" },
        h("li", null, icon("chat", "sm"), h("span", null, h("strong", null, "依頼を読む"), "右の欄に届くユーザーの依頼と条件を確認")),
        h("li", null, icon("folder_open", "sm"), h("span", null, h("strong", null, "ファイルを探す"), "左のツリーからファイルを開き、根拠の行を証拠に追加")),
        h("li", null, icon("arrow_upward", "sm"), h("span", null, h("strong", null, "成果物を提出"), "証拠を紐付けて提出。70点以上で次のステージへ")),
      ),
      h("h2", { class: "stages-title" }, "ステージ"),
      h(
        "ul",
        { class: "stages" },
        stages.map((st, i) => {
          const unlocked = save.unlocked.includes(st.id);
          const best = save.best[st.id];
          const prev = stages[i - 1];
          return h(
            "li",
            { class: `stage${unlocked ? "" : " locked"}` },
            h("span", { class: "stage-no" }, String(st.number).padStart(2, "0")),
            h(
              "div",
              { class: "stage-main" },
              h("p", { class: "stage-name" }, st.title),
              h(
                "p",
                { class: "muted small" },
                unlocked
                  ? st.answerMode === "fill"
                    ? "穴埋めで回答"
                    : "カード配置で回答"
                  : `Stage ${String(prev?.number ?? 0).padStart(2, "0")} を70点以上でクリアすると解放`,
              ),
            ),
            h(
              "div",
              { class: "stage-best" },
              best
                ? [h("span", { class: `rank-sm rank-${best.rank}` }, best.rank), h("span", null, `最高 ${best.score}点`)]
                : h("span", { class: "muted small" }, unlocked ? "未挑戦" : ""),
            ),
            unlocked
              ? h(
                  "button",
                  { class: `btn ${best ? "btn-ghost" : "btn-accent"}`, onclick: () => onStart(st.id) },
                  best ? "再挑戦" : "挑戦する",
                  icon("arrow_forward", "sm"),
                )
              : h("span", { class: "lock" }, icon("lock", "sm"), "ロック中"),
          );
        }),
      ),
      h("p", { class: "muted small foot" }, "進行状況（解放したステージと最高点）は、このブラウザにだけ保存されます。"),
    ),
  );
}
