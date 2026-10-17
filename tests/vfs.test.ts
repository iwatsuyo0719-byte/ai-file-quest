// 受け入れ条件2：フォルダを開いてファイルを読める（ツリー生成）
import { describe, expect, it } from "vitest";
import { getFiles, STAGES } from "../src/stages";
import { buildTree, splitLines } from "../src/vfs";

describe("buildTree", () => {
  it("WORKSPACE を根に、フォルダ→ファイルの順で並べる", () => {
    const tree = buildTree({ "b.md": "B", "DATA/x.csv": "X", "A/z.txt": "Z", "a.md": "A" });
    expect(tree.name).toBe("WORKSPACE");
    expect(tree.children!.map((c) => c.name)).toEqual(["A", "DATA", "a.md", "b.md"]);
    const data = tree.children!.find((c) => c.name === "DATA")!;
    expect(data.type).toBe("dir");
    expect(data.children![0]).toMatchObject({ path: "DATA/x.csv", type: "file", content: "X" });
  });

  it("Stage 01 の実ファイルからツリーが作られ、本文が読める", () => {
    const tree = buildTree(getFiles("stage01"));
    expect(tree.children!.map((c) => c.name)).toEqual(["DATA", "NOTES", "README.md"]);
    const data = tree.children!.find((c) => c.name === "DATA")!;
    expect(data.children!.map((c) => c.path)).toEqual(["DATA/august.csv", "DATA/september.csv"]);
    const sep = data.children!.find((c) => c.name === "september.csv")!;
    expect(splitLines(sep.content!)[0]).toBe("日付,商品,数量,金額");
  });

  it("CRLF の改行でも行番号がずれない", () => {
    expect(splitLines("a\r\nb\r\n")).toEqual(["a", "b"]);
  });
});

describe("ステージデータの整合性", () => {
  for (const stage of STAGES) {
    it(`${stage.id}：requiredFiles・usefulFiles が実在する`, () => {
      const files = getFiles(stage.id);
      for (const f of [...stage.requiredFiles, ...stage.usefulFiles]) expect(files).toHaveProperty([f]);
    });
  }
});
