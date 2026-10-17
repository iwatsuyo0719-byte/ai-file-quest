// 仮想ファイルシステム（読み取り専用）。stages/<id>/files/ の実ディレクトリから作る

export type VNode = {
  path: string;
  name: string;
  type: "dir" | "file";
  children?: VNode[];
  content?: string;
};

/** "DATA/a.csv" のような相対パス → 本文 の対応から、WORKSPACE を根とするツリーを作る */
export function buildTree(files: Record<string, string>, rootName = "WORKSPACE"): VNode {
  const root: VNode = { path: "", name: rootName, type: "dir", children: [] };
  for (const [path, content] of Object.entries(files)) {
    const parts = path.split("/");
    let dir = root;
    parts.forEach((name, i) => {
      const p = parts.slice(0, i + 1).join("/");
      if (i === parts.length - 1) {
        dir.children!.push({ path: p, name, type: "file", content });
        return;
      }
      let next = dir.children!.find((c) => c.type === "dir" && c.name === name);
      if (!next) {
        next = { path: p, name, type: "dir", children: [] };
        dir.children!.push(next);
      }
      dir = next;
    });
  }
  sortTree(root);
  return root;
}

function sortTree(node: VNode): void {
  if (!node.children) return;
  node.children.sort((a, b) =>
    a.type !== b.type ? (a.type === "dir" ? -1 : 1) : a.name.localeCompare(b.name, "en"),
  );
  node.children.forEach(sortTree);
}

export function splitLines(content: string): string[] {
  const lines = content.split(/\r?\n/);
  if (lines.length > 1 && lines[lines.length - 1] === "") lines.pop();
  return lines;
}

export function fileKind(path: string): "csv" | "md" | "txt" {
  if (path.endsWith(".csv")) return "csv";
  if (path.endsWith(".md")) return "md";
  return "txt";
}
