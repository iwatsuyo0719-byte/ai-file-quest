// 受け入れ条件5：ステージ解放・最高点保存
import { describe, expect, it } from "vitest";
import { applyResult, BROKEN_KEY, initialSave, loadSave, parseSave, SAVE_KEY, writeSave } from "../src/save";

class MemoryStorage implements Storage {
  private m = new Map<string, string>();
  get length() {
    return this.m.size;
  }
  clear() {
    this.m.clear();
  }
  getItem(k: string) {
    return this.m.get(k) ?? null;
  }
  key(i: number) {
    return [...this.m.keys()][i] ?? null;
  }
  removeItem(k: string) {
    this.m.delete(k);
  }
  setItem(k: string, v: string) {
    this.m.set(k, v);
  }
}

describe("save", () => {
  it("初回は stage01 だけ解放", () => {
    expect(loadSave(new MemoryStorage()).save).toEqual({ version: 1, unlocked: ["stage01"], best: {} });
  });

  it("70点以上でクリアすると次のステージを解放し、書き込み後のリロードでも保持される", () => {
    const st = new MemoryStorage();
    const loaded = loadSave(st);
    const s = applyResult(loaded.save, "stage01", { total: 85, rank: "A", cleared: true }, "stage02");
    writeSave(st, s, loaded);
    const reloaded = loadSave(st).save;
    expect(reloaded.unlocked).toEqual(["stage01", "stage02"]);
    expect(reloaded.best.stage01).toEqual({ score: 85, rank: "A" });
  });

  it("69点では解放しない", () => {
    const s = applyResult(initialSave(), "stage01", { total: 69, rank: "C", cleared: false }, "stage02");
    expect(s.unlocked).toEqual(["stage01"]);
    expect(s.best.stage01).toEqual({ score: 69, rank: "C" });
  });

  it("低い点では最高点を上書きしない。高い点なら更新する", () => {
    let s = applyResult(initialSave(), "stage01", { total: 90, rank: "S", cleared: true }, "stage02");
    s = applyResult(s, "stage01", { total: 72, rank: "B", cleared: true }, "stage02");
    expect(s.best.stage01).toEqual({ score: 90, rank: "S" });
    s = applyResult(s, "stage01", { total: 95, rank: "S", cleared: true }, "stage02");
    expect(s.best.stage01).toEqual({ score: 95, rank: "S" });
    expect(s.unlocked).toEqual(["stage01", "stage02"]);
  });

  it("重大違反（ランク—）の回は最高点に記録しない", () => {
    const s = applyResult(initialSave(), "stage01", { total: 75, rank: "—", cleared: false }, "stage02");
    expect(s.best.stage01).toBeUndefined();
    expect(s.unlocked).toEqual(["stage01"]);
  });

  it("壊れたデータは初期値で起動し、上書き前に退避して消さない", () => {
    const st = new MemoryStorage();
    st.setItem(SAVE_KEY, "{broken");
    const loaded = loadSave(st);
    expect(loaded.corrupt).toBe(true);
    expect(loaded.save).toEqual(initialSave());
    expect(st.getItem(SAVE_KEY)).toBe("{broken"); // 読んだだけでは書き換えない
    writeSave(st, applyResult(loaded.save, "stage01", { total: 80, rank: "A", cleared: true }, "stage02"), loaded);
    expect(st.getItem(BROKEN_KEY)).toBe("{broken");
  });

  it("形式が違うデータも壊れたデータとして扱う", () => {
    expect(parseSave(JSON.stringify({ version: 2, unlocked: [], best: {} })).corrupt).toBe(true);
    expect(parseSave(JSON.stringify({ version: 1, unlocked: "x", best: {} })).corrupt).toBe(true);
  });
});
