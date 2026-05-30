import type { GitFileStatus } from "../types";

/**
 * A node in the Git "Changes" tree. Folder nodes are *synthesized* from file
 * paths (unlike `buildTree`, which relies on the Rust walk emitting a real
 * entry per folder) — `git_changes` returns only file paths.
 */
export interface ChangeNode {
  /** Last path segment (display name). */
  name: string;
  /** Full relPath for files; the cumulative folder path for folders. */
  relPath: string;
  isDir: boolean;
  /** Change kind — present only on file nodes. */
  status?: GitFileStatus["status"];
  children: ChangeNode[];
}

/**
 * Build a nested folder tree from the flat `git_changes` list. relPaths are
 * forward-slashed; intermediate folders are created on demand. Folders sort
 * before files, then alphabetically (case-insensitive).
 */
export function buildChangeTree(changes: GitFileStatus[]): ChangeNode[] {
  const roots: ChangeNode[] = [];
  const folders = new Map<string, ChangeNode>();

  /** Get (creating as needed) the folder node for a cumulative folder path. */
  const getFolder = (path: string): ChangeNode => {
    const existing = folders.get(path);
    if (existing) return existing;
    const slash = path.lastIndexOf("/");
    const node: ChangeNode = {
      name: slash === -1 ? path : path.slice(slash + 1),
      relPath: path,
      isDir: true,
      children: [],
    };
    folders.set(path, node);
    if (slash === -1) roots.push(node);
    else getFolder(path.slice(0, slash)).children.push(node);
    return node;
  };

  for (const c of changes) {
    const slash = c.relPath.lastIndexOf("/");
    const fileNode: ChangeNode = {
      name: slash === -1 ? c.relPath : c.relPath.slice(slash + 1),
      relPath: c.relPath,
      isDir: false,
      status: c.status,
      children: [],
    };
    if (slash === -1) roots.push(fileNode);
    else getFolder(c.relPath.slice(0, slash)).children.push(fileNode);
  }

  const sort = (arr: ChangeNode[]) => {
    arr.sort((a, b) => {
      if (a.isDir !== b.isDir) return a.isDir ? -1 : 1;
      return a.name.toLowerCase().localeCompare(b.name.toLowerCase());
    });
    arr.forEach((n) => sort(n.children));
  };
  sort(roots);
  return roots;
}
