// 結果画面：総得点・ランク・4項目内訳・ルール・閲覧履歴・改善点（DESIGN.md §6）
import type { AnswerKey, ScoreResult, Stage } from "../types";
import { h, icon } from "./dom";

export type ResultHandlers = {
  onRetry: () => void;
  onNext: (() => void) | null;
  onTitle: () => void;
};

function improvements(stage: Stage, r: ScoreResult): string[] {
  const out: string[] = [];
  for (const f of r.fatal) out.push(`重大違反：${f.desc}。数値は必ずファイルに書かれている値を使いましょう。`);
  for (const s of r.slots) if (s.scored && !s.correct) out.push(`「${s.label}」が正しくありません。`);
  for (const e of r.evidence) if (!e.ok) out.push(`「${e.label}」の根拠が、正しい行に紐付いていません。`);
  for (const x of r.rules) if (!x.ok) out.push(`守れなかったルール：${x.desc}`);
  if (r.coverage < 25) out.push("空欄が残っています。すべての欄を埋めましょう。");
  if (r.unneededFiles.length)
    out.push(`不要なファイルを開きました：${r.unneededFiles.join("、")}（1ファイルにつき−2点）`);
  for (const f of r.repeatedFiles) out.push(`${f.file} を${f.views}回表示しました（4回目以降は1回につき−1点）`);
  if (r.hintPenalty) out.push(`ヒントで${r.hintPenalty}点減点されました。`);
  if (!out.length) out.push(stage.number === 1 ? "改善点はありません。完璧です。" : "改善点はありません。指示どおりの仕事です。");
  return out;
}

function fileTag(stage: Stage, f: string): { label: string; cls: string } {
  if (stage.requiredFiles.includes(f)) return { label: "必要", cls: "tag-ok" };
  if (stage.usefulFiles.includes(f)) return { label: "参考", cls: "tag-info" };
  return { label: "不要", cls: "tag-bad" };
}

export function renderResult(
  stage: Stage,
  key: AnswerKey,
  r: ScoreResult,
  history: string[],
  isNewBest: boolean,
  on: ResultHandlers,
): HTMLElement {
  const status = r.fatal.length ? "不合格（重大違反）" : r.cleared ? "クリア" : "あと少し（70点以上でクリア）";
  const rows: [string, number, number, string?][] = [
    ["正確性", r.accuracy, 40],
    ["網羅性", r.coverage, 25],
    ["根拠・指示遵守", r.compliance, 20, `根拠 ${r.evidenceScore} / 10・ルール ${r.ruleScore} / 10`],
    ["探索効率", r.efficiency, 15],
  ];
  return h(
    "main",
    { class: "result" },
    h(
      "div",
      { class: "result-card" },
      h("p", { class: "eyebrow" }, `Stage ${String(stage.number).padStart(2, "0")}｜${stage.title}`),
      h(
        "div",
        { class: "score-head" },
        h(
          "div",
          { class: "score-big", "aria-label": `${r.total}点` },
          h("span", { class: "score-num" }, r.total),
          h("span", { class: "score-max" }, "/ 100"),
        ),
        h("div", { class: `rank rank-${r.rank === "—" ? "none" : r.rank}`, "aria-label": `ランク ${r.rank}` }, r.rank),
        h(
          "div",
          { class: "score-status" },
          h(
            "p",
            { class: `status ${r.cleared ? "ok" : "bad"}` },
            icon(r.cleared ? "check_circle" : r.fatal.length ? "block" : "error", "sm"),
            status,
          ),
          isNewBest ? h("p", { class: "muted small" }, "自己ベストを更新しました") : null,
        ),
      ),
      r.fatal.length
        ? h(
            "div",
            { class: "alert", role: "alert" },
            icon("block", "sm"),
            h("div", null, h("strong", null, "重大違反のため点数にかかわらず不合格です"), r.fatal.map((f) => h("p", null, f.desc))),
          )
        : null,
      h(
        "table",
        { class: "breakdown" },
        h(
          "tbody",
          null,
          rows.map(([name, v, max, note]) =>
            h(
              "tr",
              null,
              h("th", null, name, note ? h("span", { class: "muted small note" }, note) : null),
              h("td", null, h("div", { class: "bar" }, h("span", { style: `width:${(v / max) * 100}%` }))),
              h("td", { class: "num" }, `${v} / ${max}`),
            ),
          ),
          r.hintPenalty
            ? h("tr", null, h("th", null, "ヒント"), h("td"), h("td", { class: "num bad" }, `−${r.hintPenalty}`))
            : null,
        ),
      ),
      h(
        "div",
        { class: "result-cols" },
        h(
          "section",
          null,
          h("h2", { class: "block-title" }, icon("rule", "sm"), "指示の遵守"),
          r.rules.length
            ? h(
                "ul",
                { class: "rules" },
                r.rules.map((x) =>
                  h("li", { class: x.ok ? "ok" : "bad" }, icon(x.ok ? "check_circle" : "cancel", "sm"), h("span", null, x.desc), h("span", { class: "sr-only" }, x.ok ? "（守れた）" : "（守れなかった）")),
                ),
              )
            : h("p", { class: "muted small" }, "このステージに指示ファイルのルールはありません（10点満点）。"),
          h("h2", { class: "block-title" }, icon("history", "sm"), "閲覧履歴"),
          history.length
            ? h(
                "ol",
                { class: "history" },
                history.map((f) => {
                  const t = fileTag(stage, f);
                  return h("li", null, h("span", { class: `tag ${t.cls}` }, t.label), f);
                }),
              )
            : h("p", { class: "muted small" }, "ファイルを1つも開きませんでした。"),
        ),
        h(
          "section",
          null,
          h("h2", { class: "block-title" }, icon("tips_and_updates", "sm"), "改善点"),
          h("ul", { class: "improve" }, improvements(stage, r).map((t) => h("li", null, t))),
          h("h2", { class: "block-title" }, icon("menu_book", "sm"), "解説"),
          h("p", { class: "explain" }, key.explanation),
        ),
      ),
      h(
        "div",
        { class: "result-actions" },
        h("button", { class: "btn btn-ghost", onclick: on.onTitle }, icon("grid_view", "sm"), "ステージ選択"),
        h("button", { class: "btn btn-ghost", onclick: on.onRetry }, icon("restart_alt", "sm"), "リトライ"),
        on.onNext
          ? h("button", { class: "btn btn-accent", onclick: on.onNext }, "次のステージへ", icon("arrow_forward", "sm"))
          : null,
      ),
    ),
  );
}
