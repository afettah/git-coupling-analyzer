/**
 * Tree Utilities
 * 
 * Functions for building and manipulating tree structures from file paths.
 */

import type { TreeNode, FolderCount } from '../types';

// ============================================================
// File Tree Building
// ============================================================

/** Build a hierarchical tree structure from flat file paths */
export function buildFileTree(files: string[]): TreeNode {
    const root: TreeNode = { name: 'root', path: '', children: [], files: [] };

    files.forEach((file) => {
        const parts = file.split('/').filter(Boolean);
        let current = root;

        parts.forEach((part, index) => {
            const isFile = index === parts.length - 1;

            if (isFile) {
                current.files.push(file);
                return;
            }

            let child = current.children.find((c: TreeNode) => c.name === part);
            if (!child) {
                child = {
                    name: part,
                    path: current.path ? `${current.path}/${part}` : part,
                    children: [],
                    files: []
                };
                current.children.push(child);
            }
            current = child;
        });
    });

    sortTreeRecursive(root);
    return root;
}

/** Sort tree nodes alphabetically */
function sortTreeRecursive(node: TreeNode): void {
    node.children.sort((a: TreeNode, b: TreeNode) => a.name.localeCompare(b.name));
    node.files.sort((a: string, b: string) => a.localeCompare(b));
    node.children.forEach((child: TreeNode) => sortTreeRecursive(child));
}

// ============================================================
// Folder Aggregation
// ============================================================

/** Aggregate files by folder path up to a certain depth */
export function aggregateFolders(files: string[], depth: number): FolderCount[] {
    const counts = new Map<string, number>();

    files.forEach((file) => {
        const folder = getFolderPathInternal(file, depth);
        if (!folder) return;
        counts.set(folder, (counts.get(folder) || 0) + 1);
    });

    return Array.from(counts.entries())
        .map(([path, count]) => ({ path, count }))
        .sort((a, b) => b.count - a.count);
}

function getFolderPathInternal(path: string, depth: number): string {
    const parts = path.split('/').filter(Boolean);
    if (parts.length === 0) return '';
    return parts.slice(0, Math.min(depth, parts.length - 1)).join('/');
}

/** Get unique folder paths from files */
export function getUniqueFolders(files: string[]): string[] {
    const folders = new Set<string>();

    files.forEach(file => {
        const parts = file.split('/').filter(Boolean);
        if (parts.length > 1) {
            folders.add(parts.slice(0, -1).join('/'));
        }
    });

    return Array.from(folders).sort();
}

/** Count files per folder */
export function countFilesPerFolder(files: string[]): Map<string, number> {
    const counts = new Map<string, number>();

    files.forEach(file => {
        const parts = file.split('/').filter(Boolean);
        if (parts.length > 1) {
            const folder = parts.slice(0, -1).join('/');
            counts.set(folder, (counts.get(folder) || 0) + 1);
        }
    });

    return counts;
}

// ============================================================
// Tree Traversal
// ============================================================

/** Get all files from a tree node recursively */
export function getAllFilesFromTree(node: TreeNode): string[] {
    const files: string[] = [...node.files];

    node.children.forEach((child: TreeNode) => {
        files.push(...getAllFilesFromTree(child));
    });

    return files;
}

/** Find a node in the tree by path */
export function findNodeByPath(root: TreeNode, path: string): TreeNode | null {
    if (root.path === path) return root;

    for (const child of root.children) {
        const found = findNodeByPath(child, path);
        if (found) return found;
    }

    return null;
}

/** Get the depth of a tree */
export function getTreeDepth(node: TreeNode): number {
    if (node.children.length === 0) return 1;
    return 1 + Math.max(...node.children.map(getTreeDepth));
}
