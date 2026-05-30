import type { FileEntry } from "../types";

/** A node in the workspace file tree. */
export interface TreeNode {
  entry: FileEntry;
  children: TreeNode[];
}

/**
 * Build a nested tree from the flat entry list returned by `list_entries`.
 * Parent of an entry is its `relPath` minus the last segment; the Rust walk
 * emits every parent directory, so each parent node exists. Folders sort
 * before files, then alphabetically.
 */
export function buildTree(entries: FileEntry[]): TreeNode[] {
  const nodes = new Map<string, TreeNode>();
  for (const entry of entries) {
    nodes.set(entry.relPath, { entry, children: [] });
  }

  const roots: TreeNode[] = [];
  for (const entry of entries) {
    const node = nodes.get(entry.relPath)!;
    const slash = entry.relPath.lastIndexOf("/");
    if (slash === -1) {
      roots.push(node);
    } else {
      const parent = nodes.get(entry.relPath.slice(0, slash));
      if (parent) parent.children.push(node);
      else roots.push(node); // defensive: orphan without a listed parent
    }
  }

  const sortNodes = (arr: TreeNode[]) => {
    arr.sort((a, b) => {
      if (a.entry.isDir !== b.entry.isDir) return a.entry.isDir ? -1 : 1;
      return a.entry.name.toLowerCase().localeCompare(b.entry.name.toLowerCase());
    });
    arr.forEach((n) => sortNodes(n.children));
  };
  sortNodes(roots);
  return roots;
}
