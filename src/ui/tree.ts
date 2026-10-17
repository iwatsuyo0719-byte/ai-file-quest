// 左カラム：仮想フォルダツリー
import type { GameState } from "../state";
import { fileKind, type VNode } from "../vfs";
import { h, icon } from "./dom";

export type TreeHandlers = {
  onToggle: (path: string) => void;
  onOpen: (path: string) => void;
};

function fileIcon(path: string): string {
  return fileKind(path) === "csv" ? "table_chart" : "description";
}

function renderNode(node: VNode, depth: number, s: GameState, on: TreeHandlers): HTMLElement {
  const pad = { style: `padding-left:${8 + depth * 14}px` };
  if (node.type === "file") {
    const active = s.activeFile === node.path;
    const seen = s.history.includes(node.path);
    return h(
      "li",
      { role: "none" },
      h(
        "button",
        {
          class: `tree-item file${active ? " active" : ""}`,
          role: "treeitem",
          "aria-current": active ? "true" : null,
          "data-path": node.path,
          title: node.path,
          onclick: () => on.onOpen(node.path),
          ...pad,
        },
        h("span", { class: "tree-chevron-space" }),
        icon(fileIcon(node.path), "tree-icon"),
        h("span", { class: "tree-name" }, node.name),
        seen && !active ? h("span", { class: "tree-seen", title: "開いたことがあるファイル" }, "既読") : null,
      ),
    );
  }
  const open = s.openDirs.has(node.path);
  return h(
    "li",
    { role: "none" },
    h(
      "button",
      {
        class: "tree-item dir",
        role: "treeitem",
        "aria-expanded": String(open),
        "data-path": node.path,
        onclick: () => on.onToggle(node.path),
        ...pad,
      },
      icon(open ? "expand_more" : "chevron_right", "tree-chevron"),
      icon(open ? "folder_open" : "folder", "tree-icon"),
      h("span", { class: "tree-name" }, node.name),
    ),
    open
      ? h("ul", { role: "group" }, (node.children ?? []).map((c) => renderNode(c, depth + 1, s, on)))
      : null,
  );
}

export function renderTree(root: VNode, s: GameState, on: TreeHandlers): HTMLElement {
  return h(
    "nav",
    { class: "tree", "aria-label": "ファイルツリー" },
    h("div", { class: "col-title" }, "エクスプローラー"),
    h("ul", { role: "tree", "aria-label": "WORKSPACE" }, renderNode(root, 0, s, on)),
  );
}
