// localStorage への保存（DESIGN.md §7）。保存するのは解放状態と最高点だけ
import type { Rank } from "./types";

export const SAVE_KEY = "aifq.save.v1";
/** 読めなかった保存データの退避先。壊れたデータは消さない */
export const BROKEN_KEY = "aifq.save.v1.broken";

export type Save = {
  version: 1;
  unlocked: string[];
  best: Record<string, { score: number; rank: Rank }>;
};

export type Loaded = { save: Save; corrupt: boolean; raw: string | null };

export function initialSave(firstStage = "stage01"): Save {
  return { version: 1, unlocked: [firstStage], best: {} };
}

function isSave(v: unknown): v is Save {
  if (!v || typeof v !== "object") return false;
  const s = v as Record<string, unknown>;
  if (s.version !== 1 || !Array.isArray(s.unlocked) || !s.unlocked.every((x) => typeof x === "string")) return false;
  if (!s.best || typeof s.best !== "object") return false;
  return Object.values(s.best as Record<string, unknown>).every((b) => {
    const r = b as Record<string, unknown>;
    return !!r && typeof r.score === "number" && typeof r.rank === "string";
  });
}

export function parseSave(raw: string | null): Loaded {
  if (raw == null) return { save: initialSave(), corrupt: false, raw };
  try {
    const v: unknown = JSON.parse(raw);
    if (isSave(v)) return { save: v, corrupt: false, raw };
  } catch {
    // 下で初期値に戻す
  }
  return { save: initialSave(), corrupt: true, raw };
}

export function loadSave(storage: Storage): Loaded {
  try {
    return parseSave(storage.getItem(SAVE_KEY));
  } catch {
    return { save: initialSave(), corrupt: false, raw: null };
  }
}

/**
 * 結果を反映した新しい Save を返す。最高点は今回が上回った時だけ更新。
 * 重大違反（rank「—」）の回は記録しない。クリアなら次のステージを解放する。
 */
export function applyResult(
  save: Save,
  stageId: string,
  result: { total: number; rank: Rank; cleared: boolean },
  next: string | null,
): Save {
  const out: Save = { version: 1, unlocked: [...save.unlocked], best: { ...save.best } };
  if (result.rank !== "—") {
    const prev = out.best[stageId];
    if (!prev || result.total > prev.score) out.best[stageId] = { score: result.total, rank: result.rank };
  }
  if (result.cleared && next && !out.unlocked.includes(next)) out.unlocked.push(next);
  return out;
}

/** 書き込む。起動時に壊れていたデータは、初めて上書きする前に退避しておく */
export function writeSave(storage: Storage, save: Save, loaded: Loaded): boolean {
  try {
    if (loaded.corrupt && loaded.raw != null && storage.getItem(BROKEN_KEY) == null) {
      storage.setItem(BROKEN_KEY, loaded.raw);
    }
    storage.setItem(SAVE_KEY, JSON.stringify(save));
    return true;
  } catch {
    return false;
  }
}
