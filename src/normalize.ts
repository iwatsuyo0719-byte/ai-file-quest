// 回答の正規化（DESIGN.md §5）：全角→半角、カンマ・「円」・空白を除去して数値比較。率は小数第1位で比較

export function toHalfWidth(s: string): string {
  return s.normalize("NFKC").replace(/[−‐-―]/g, "-");
}

export function normalizeText(s: string): string {
  return toHalfWidth(s).trim().replace(/\s+/g, " ").toLowerCase();
}

/** 空欄と「未入力」は未記入として扱う */
export function isBlank(s: string | null | undefined): boolean {
  if (s == null) return true;
  const t = normalizeText(s);
  return t === "" || t === "未入力";
}

const NUMERIC = /^-?\d+(\.\d+)?$/;

export function normalizeNumber(s: string): number | null {
  const t = toHalfWidth(s).replace(/[,\s円+]/g, "").replace(/^¥/, "");
  return NUMERIC.test(t) ? Number(t) : null;
}

export function normalizePercent(s: string): number | null {
  const t = toHalfWidth(s).replace(/[,\s+%]/g, "");
  if (!NUMERIC.test(t)) return null;
  return Math.round(Number(t) * 10) / 10;
}

export function sameValue(value: string, expected: string, mode: "number" | "text" | "percent"): boolean {
  if (isBlank(value)) return false;
  if (mode === "text") return normalizeText(value) === normalizeText(expected);
  const f = mode === "number" ? normalizeNumber : normalizePercent;
  const a = f(value);
  const b = f(expected);
  return a !== null && b !== null && a === b;
}

/** 小数点以下の桁数（"30.21%" → 2、"25.0%" → 1、"30%" → 0） */
export function decimalsOf(s: string): number {
  const t = toHalfWidth(s).replace(/[,\s+%]/g, "");
  const m = t.match(/\.(\d+)$/);
  return m ? m[1].length : 0;
}

/** 1行から数値を取り出す。日付（2026-09-03）は数値として扱わない */
export function extractNumbers(text: string, isCsv: boolean): number[] {
  if (isCsv) {
    return text
      .split(",")
      .map((c) => c.trim())
      .filter((c) => NUMERIC.test(c))
      .map(Number);
  }
  const t = toHalfWidth(text).replace(/\d{4}-\d{2}-\d{2}/g, " ");
  const found = t.match(/-?\d{1,3}(?:,\d{3})+(?:\.\d+)?|-?\d+(?:\.\d+)?/g) ?? [];
  return found.map((n) => Number(n.replace(/,/g, "")));
}

export function formatNumber(n: number): string {
  return n.toLocaleString("ja-JP");
}
