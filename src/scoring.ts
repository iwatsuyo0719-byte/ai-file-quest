// 採点（純関数）。DESIGN.md §5：正確性40＋網羅性25＋根拠・指示遵守20＋探索効率15
import { decimalsOf, extractNumbers, isBlank, normalizeNumber, sameValue } from "./normalize";
import type { AnswerKey, Rank, RuleCheck, ScoreResult, Stage, Submission } from "./types";
import { fileKind, splitLines } from "./vfs";

export const CLEAR_SCORE = 70;
/** 同じファイルの表示はこの回数まで減点しない（4回目以降を1点ずつ減点） */
export const FREE_VIEWS = 3;

export function rankOf(total: number): Exclude<Rank, "—"> {
  if (total >= 90) return "S";
  if (total >= 80) return "A";
  if (total >= 70) return "B";
  return "C";
}

type Ctx = {
  key: AnswerKey;
  sub: Submission;
  fileNumbers: Set<number>;
};

function valueOf(ctx: Ctx, slot: string): string {
  return ctx.sub.answers[slot]?.value ?? "";
}

function accepted(ctx: Ctx, slot: string): boolean {
  const k = ctx.key.slots[slot];
  if (!k) return false;
  const v = valueOf(ctx, slot);
  return k.accept.some((a) => sameValue(v, a, k.normalize));
}

export function evaluate(check: RuleCheck, ctx: Ctx): boolean {
  switch (check.type) {
    case "slotAccepted":
      return accepted(ctx, check.slot);
    case "slotNotIn": {
      const v = valueOf(ctx, check.slot);
      return !check.values.some((x) => sameValue(v, x, check.normalize));
    }
    case "viewed":
      return ctx.sub.history.includes(check.file);
    case "decimals": {
      const v = valueOf(ctx, check.slot);
      return !isBlank(v) && decimalsOf(v) === check.digits;
    }
    case "rowOrder": {
      const order = ctx.sub.rowOrder ?? [];
      return order.length === check.order.length && check.order.every((s, i) => order[i] === s);
    }
    case "fabricatedNumber":
      // 根拠付きで出した数値スロットのうち、どのファイルにも無い数値があれば違反
      return Object.entries(ctx.sub.answers).some(([slot, a]) => {
        if (ctx.key.slots[slot]?.normalize !== "number" || !a.evidence) return false;
        const n = normalizeNumber(a.value);
        return n !== null && !ctx.fileNumbers.has(n);
      });
    case "all":
      return check.checks.every((c) => evaluate(c, ctx));
  }
}

export function collectNumbers(files: Record<string, string>): Set<number> {
  const set = new Set<number>();
  for (const [path, content] of Object.entries(files)) {
    const csv = fileKind(path) === "csv";
    for (const line of splitLines(content)) extractNumbers(line, csv).forEach((n) => set.add(n));
  }
  return set;
}

const round1 = (n: number) => Math.round(n * 10) / 10;

export function score(
  stage: Stage,
  key: AnswerKey,
  sub: Submission,
  files: Record<string, string>,
): ScoreResult {
  const ctx: Ctx = { key, sub, fileNumbers: collectNumbers(files) };

  // 正確性40
  const slots = Object.entries(key.slots).map(([slot, k]) => ({
    slot,
    label: k.label,
    correct: accepted(ctx, slot),
    scored: k.accuracy !== false,
  }));
  const scored = slots.filter((s) => s.scored);
  const accuracy = scored.length ? (40 * scored.filter((s) => s.correct).length) / scored.length : 40;

  // 網羅性25
  const coverage = sub.total ? (25 * Math.min(sub.filled, sub.total)) / sub.total : 0;

  // 根拠10：同じスロットに複数の requiredEvidence があれば、どれか1つに一致すればよい
  const evSlots = [...new Set(key.requiredEvidence.map((e) => e.slot))];
  const evidence = evSlots.map((slot) => {
    const ev = sub.answers[slot]?.evidence;
    const ok =
      !!ev && key.requiredEvidence.some((r) => r.slot === slot && r.file === ev.file && r.line === ev.line);
    return { slot, label: key.slots[slot]?.label ?? slot, ok };
  });
  const evidenceScore = evSlots.length ? (10 * evidence.filter((e) => e.ok).length) / evSlots.length : 10;

  // 指示遵守10：ルールが無いステージは満点
  const rules = key.rules.map((r) => ({ id: r.id, desc: r.desc, ok: evaluate(r.check, ctx) }));
  const ruleScore = rules.length ? (10 * rules.filter((r) => r.ok).length) / rules.length : 10;

  // 探索効率15：不要ファイル1種につき−2、同じファイルの4回目以降の表示1回につき−1、下限5
  const allowed = new Set([...stage.requiredFiles, ...stage.usefulFiles]);
  const views = new Map<string, number>();
  sub.history.forEach((f) => views.set(f, (views.get(f) ?? 0) + 1));
  const unneededFiles = [...views.keys()].filter((f) => !allowed.has(f));
  const repeatedFiles = [...views.entries()]
    .filter(([, n]) => n > FREE_VIEWS)
    .map(([file, n]) => ({ file, views: n, penalty: n - FREE_VIEWS }));
  const efficiency = Math.max(
    5,
    15 - unneededFiles.length * 2 - repeatedFiles.reduce((a, r) => a + r.penalty, 0),
  );

  // ヒント：開いた段までの減点を合計
  const hintPenalty = stage.hintPenalties.slice(0, sub.hintsUsed).reduce((a, b) => a + b, 0);

  const fatal = key.fatal.filter((f) => evaluate(f.check, ctx)).map((f) => ({ id: f.id, desc: f.desc }));

  const compliance = evidenceScore + ruleScore;
  const total = Math.max(0, Math.round(accuracy + coverage + compliance + efficiency - hintPenalty));
  const rank: Rank = fatal.length ? "—" : rankOf(total);

  return {
    accuracy: round1(accuracy),
    coverage: round1(coverage),
    evidenceScore: round1(evidenceScore),
    ruleScore: round1(ruleScore),
    compliance: round1(compliance),
    efficiency,
    hintPenalty,
    total,
    rank,
    cleared: fatal.length === 0 && total >= CLEAR_SCORE,
    fatal,
    slots,
    evidence,
    rules,
    unneededFiles,
    repeatedFiles,
  };
}
