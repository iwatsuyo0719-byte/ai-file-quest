// 受け入れ条件1・3・4：各ステージの正答ルート／誤答ルート、指示ファイルの反映、採点
import { describe, expect, it } from "vitest";
import { sameValue } from "../src/normalize";
import { rankOf, score } from "../src/scoring";
import { getFiles, getStage } from "../src/stages";
import {
  canSubmit,
  createState,
  type GameState,
  openFile,
  openNextHint,
  removeEvidence,
  setFillEvidence,
  setFillValue,
  slotsMissingEvidence,
  toSubmission,
} from "../src/state";
import type { StageId } from "../src/types";
import { collect, KEYS, newGame, place } from "./helpers";

function grade(s: GameState) {
  const id = s.stage.id as StageId;
  return score(getStage(id), KEYS[id], toSubmission(s, KEYS[id]), getFiles(id));
}

describe("正規化", () => {
  it("全角・カンマ・円・空白を無視して数値比較する", () => {
    expect(sameValue("１，２５０，０００円", "1250000", "number")).toBe(true);
    expect(sameValue(" 1 250 000 ", "1250000", "number")).toBe(true);
    expect(sameValue("1250001", "1250000", "number")).toBe(false);
  });
  it("率は小数第1位に四捨五入して比較し、% の有無は問わない", () => {
    expect(sameValue("30.21%", "30.2", "percent")).toBe(true);
    expect(sameValue("30.2", "30.2", "percent")).toBe(true);
    expect(sameValue("３０．２％", "30.2", "percent")).toBe(true);
    expect(sameValue("25.0%", "30.2", "percent")).toBe(false);
  });
  it("「未入力」は空欄と同じ", () => {
    expect(sameValue("未入力", "未入力", "text")).toBe(false);
  });
});

describe("ランク", () => {
  it("S 90〜／A 80〜／B 70〜／C 〜69", () => {
    expect([100, 90, 89, 80, 79, 70, 69, 0].map(rankOf)).toEqual(["S", "S", "A", "A", "B", "B", "C", "C"]);
  });
});

describe("Stage 01 ファイルを探せ", () => {
  function correct() {
    const s = newGame("stage01");
    openFile(s, "README.md");
    const ev = collect(s, "DATA/september.csv", 7);
    setFillValue(s, "amount", "1,250,000");
    setFillEvidence(s, "amount", ev);
    return s;
  }

  it("正答ルート：満点・S・クリア", () => {
    const r = grade(correct());
    expect(r).toMatchObject({ accuracy: 40, coverage: 25, compliance: 20, efficiency: 15, total: 100, rank: "S" });
    expect(r.cleared).toBe(true);
  });

  it("値を入れたのに根拠を選んでいない欄を検出する（提出は止めない）", () => {
    const s = newGame("stage01");
    expect(slotsMissingEvidence(s)).toEqual([]); // 未入力の欄は対象外
    setFillValue(s, "amount", "1250000");
    expect(slotsMissingEvidence(s).map((x) => x.id)).toEqual(["amount"]);
    expect(canSubmit(s)).toBe(true);
    const ev = collect(s, "DATA/september.csv", 7);
    setFillEvidence(s, "amount", ev);
    expect(slotsMissingEvidence(s)).toEqual([]);
    expect(slotsMissingEvidence(newGame("stage03"))).toEqual([]);
  });

  it("全スロットを入力するまで提出できない", () => {
    const s = newGame("stage01");
    expect(canSubmit(s)).toBe(false);
    setFillValue(s, "amount", "未入力");
    expect(canSubmit(s)).toBe(false);
    setFillValue(s, "amount", "1250000");
    expect(canSubmit(s)).toBe(true);
  });

  it("誤答ルート：8月の合計を答えると正確性0・根拠0で不合格", () => {
    const s = newGame("stage01");
    const ev = collect(s, "DATA/august.csv", 6);
    setFillValue(s, "amount", "960000");
    setFillEvidence(s, "amount", ev);
    const r = grade(s);
    expect(r.accuracy).toBe(0);
    expect(r.evidenceScore).toBe(0);
    expect(r.unneededFiles).toEqual(["DATA/august.csv"]);
    expect(r.total).toBe(0 + 25 + 0 + 10 + 13);
    expect(r.cleared).toBe(false);
    expect(r.rank).toBe("C");
  });

  it("根拠を紐付けないと根拠点（10点）を失う", () => {
    const s = correct();
    setFillEvidence(s, "amount", null);
    const r = grade(s);
    expect(r.evidenceScore).toBe(0);
    expect(r.total).toBe(90);
  });

  it("重大違反：どのファイルにも無い数値を根拠付きで出すと、点数にかかわらず不合格・ランク—", () => {
    const s = correct();
    setFillValue(s, "amount", "1300000");
    const r = grade(s);
    expect(r.fatal.map((f) => f.id)).toEqual(["fabricated"]);
    expect(r.rank).toBe("—");
    expect(r.cleared).toBe(false);
  });

  it("ファイルにある数値なら誤答でも重大違反にはしない", () => {
    const s = correct();
    setFillValue(s, "amount", "600000");
    expect(grade(s).fatal).toEqual([]);
  });

  it("Stage 01 はヒントを3段とも開いても減点なし", () => {
    const s = correct();
    openNextHint(s);
    openNextHint(s);
    openNextHint(s);
    expect(grade(s).hintPenalty).toBe(0);
    expect(grade(s).total).toBe(100);
  });
});

describe("探索効率", () => {
  it("不要ファイル1種につき−2、4回目以降の表示1回につき−1、下限5", () => {
    const s = newGame("stage01");
    openFile(s, "NOTES/memo.md");
    openFile(s, "DATA/august.csv");
    for (let i = 0; i < 4; i++) {
      openFile(s, "README.md");
      openFile(s, "DATA/september.csv");
    }
    const r = grade(s);
    expect(r.unneededFiles.sort()).toEqual(["DATA/august.csv", "NOTES/memo.md"]);
    expect(r.repeatedFiles).toEqual([
      { file: "README.md", views: 4, penalty: 1 },
      { file: "DATA/september.csv", views: 4, penalty: 1 },
    ]);
    expect(r.efficiency).toBe(15 - 4 - 2);
  });

  it("どれだけ迷っても探索効率は5点を下回らない", () => {
    const s = newGame("stage01");
    for (let i = 0; i < 20; i++) {
      openFile(s, "NOTES/memo.md");
      openFile(s, "DATA/august.csv");
    }
    expect(grade(s).efficiency).toBe(5);
  });

  it("表示中のファイルを再クリックしても反復に数えない", () => {
    const s = newGame("stage01");
    openFile(s, "README.md");
    openFile(s, "README.md");
    expect(s.history).toEqual(["README.md"]);
  });
});

describe("Stage 02 AIのルールを守れ", () => {
  function play(amount: string, tax: string, ref = "DATA/sales_september.csv") {
    const s = newGame("stage02");
    openFile(s, "AGENTS.md");
    openFile(s, "RULES/accounting.md");
    const ev = collect(s, "DATA/sales_september.csv", 7);
    setFillValue(s, "amount", amount);
    setFillEvidence(s, "amount", ev);
    setFillValue(s, "taxType", tax);
    setFillValue(s, "refFile", ref);
    return s;
  }

  it("正答ルート：税抜・参照ファイル・AGENTS.md閲覧で満点", () => {
    const r = grade(play("1420000", "税抜"));
    expect(r.total).toBe(100);
    expect(r.rules.every((x) => x.ok)).toBe(true);
  });

  it("指示ファイルの反映：税込で答えると正確性0・ルール①未充足で不合格", () => {
    const r = grade(play("1562000", "税込"));
    expect(r.accuracy).toBe(0);
    expect(r.rules.find((x) => x.id === "taxExcluded")!.ok).toBe(false);
    expect(r.ruleScore).toBeCloseTo(6.7, 1);
    expect(r.cleared).toBe(false);
    expect(r.fatal).toEqual([]);
  });

  it("AGENTS.md を読まずに答えるとルール③未充足", () => {
    const s = newGame("stage02");
    const ev = collect(s, "DATA/sales_september.csv", 7);
    setFillValue(s, "amount", "1420000");
    setFillEvidence(s, "amount", ev);
    setFillValue(s, "taxType", "税抜");
    setFillValue(s, "refFile", "DATA/sales_september.csv");
    const r = grade(s);
    expect(r.rules.find((x) => x.id === "readAgents")!.ok).toBe(false);
  });

  it("参照ファイルを間違えるとルール②未充足", () => {
    const r = grade(play("1420000", "税抜", "DATA/sales_august.csv"));
    expect(r.rules.find((x) => x.id === "refFile")!.ok).toBe(false);
    expect(r.accuracy).toBe(40);
  });

  it("ヒント減点：2段目−3、3段目−5（最大−8）", () => {
    const s = play("1420000", "税抜");
    openNextHint(s);
    expect(grade(s).total).toBe(100);
    openNextHint(s);
    expect(grade(s).total).toBe(97);
    openNextHint(s);
    expect(grade(s).total).toBe(92);
  });
});

describe("Stage 03 複数資料を照合せよ", () => {
  function play(opts: { aug?: number; rate?: string; order?: string[] } = {}) {
    const s = newGame("stage03");
    openFile(s, "AGENTS.md");
    openFile(s, "DATA/notes.md");
    openFile(s, "REFERENCES/glossary.md");
    openFile(s, "TEMPLATES/comparison.md");
    collect(s, "DATA/august.csv", opts.aug ?? 8);
    collect(s, "DATA/september.csv", 7);
    const augValue = (opts.aug ?? 8) === 8 ? "960,000" : "1,000,000";
    const diff = augValue === "960,000" ? "+290,000" : "+250,000";
    const values: Record<string, string> = {
      "8月売上": augValue,
      "9月売上": "1,250,000",
      増減額: diff,
      増減率: opts.rate ?? "30.2%",
    };
    const order = opts.order ?? ["8月売上", "9月売上", "増減額", "増減率"];
    order.forEach((label, row) => {
      place(s, label, row, "label");
      place(s, values[label], row, "value");
    });
    return s;
  }

  it("正答ルート：満点・S", () => {
    const r = grade(play());
    expect(r).toMatchObject({ accuracy: 40, coverage: 25, compliance: 20, efficiency: 15, total: 100, rank: "S" });
  });

  it("指示ファイルの反映：増減率の桁違い（30.21%）は正確性は保つがルール②で減点", () => {
    const r = grade(play({ rate: "30.21%" }));
    expect(r.accuracy).toBe(40);
    expect(r.rules.find((x) => x.id === "rateDecimals")!.ok).toBe(false);
    expect(r.total).toBe(97);
  });

  it("返品前の8月数値を使うとルール①未充足・正確性も下がる", () => {
    const r = grade(play({ aug: 7, rate: "25.0%" }));
    expect(r.rules.find((x) => x.id === "afterReturns")!.ok).toBe(false);
    expect(r.accuracy).toBe(10);
    expect(r.evidence.find((e) => e.slot === "aug")!.ok).toBe(false);
    expect(r.cleared).toBe(false);
  });

  it("テンプレートと違う並び順はルール③未充足", () => {
    const r = grade(play({ order: ["9月売上", "8月売上", "増減額", "増減率"] }));
    expect(r.rules.find((x) => x.id === "templateOrder")!.ok).toBe(false);
    expect(r.accuracy).toBe(40);
  });

  it("空欄のセルは網羅性から引かれる", () => {
    const s = newGame("stage03");
    place(s, "8月売上", 0, "label");
    place(s, "+290,000", 0, "value");
    const sub = toSubmission(s, KEYS.stage03);
    expect(sub.filled).toBe(2);
    expect(grade(s).coverage).toBe(6.3);
  });

  it("証拠を削除すると、その証拠から作った値カードは表から外れる", () => {
    const s = newGame("stage03");
    const ev = collect(s, "DATA/september.csv", 7);
    place(s, "1,250,000", 0, "value");
    removeEvidence(s, ev);
    expect(s.cells[0].value).toBeNull();
  });
});

describe("リトライ", () => {
  it("閲覧履歴・証拠・回答・ヒントを初期化する", () => {
    const s = newGame("stage02");
    const ev = collect(s, "AGENTS.md", 6);
    setFillValue(s, "amount", "1");
    setFillEvidence(s, "amount", ev);
    openNextHint(s);
    const r = createState(s.stage, s.files);
    expect(r.history).toEqual([]);
    expect(r.evidence).toEqual([]);
    expect(r.hintsUsed).toBe(0);
    expect(r.fill.amount).toEqual({ value: "", evidenceId: null });
  });
});

describe("正答データの整合性", () => {
  for (const id of ["stage01", "stage02", "stage03"] as const) {
    it(`${id}：requiredEvidence の行に正答の数値が書かれている`, () => {
      const files = getFiles(id);
      for (const ev of KEYS[id].requiredEvidence) {
        const line = files[ev.file].split("\n")[ev.line - 1];
        const accept = KEYS[id].slots[ev.slot].accept[0];
        expect(line.split(",")).toContain(accept);
      }
    });
  }
});
