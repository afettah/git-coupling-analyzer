# Task 03: Add "Open in Git Repo" Button Next to Copy Path

## Issue
There is no visible button to open a file directly in the git hosting provider (GitHub, Azure DevOps, etc.) from the file row. Currently this functionality is only available via the right-click context menu.

## Expected Behavior
- Each file row should have an icon button (e.g., `ExternalLink`) next to the existing UI that opens the file in the git web interface (GitHub, GitLab, Azure DevOps, Bitbucket).
- The button should only be visible when `gitWebUrl` and `defaultBranch` are configured.
- URL generation logic already exists in `FileContextMenu.tsx` and should be reused.

## Files to Modify
- `src/frontend/src/features/git/files/FileRow.tsx` — Add an `ExternalLink` icon button. Accept new props: `gitWebUrl`, `gitProvider`, `defaultBranch`. Reuse the URL construction logic from `FileContextMenu.tsx`.
- `src/frontend/src/features/git/files/FilesTree.tsx` — Pass `gitWebUrl`, `gitProvider`, `defaultBranch` props through to `FileRow`.
- `src/frontend/src/features/git/files/FilesTable.tsx` — Same as above.
- `src/frontend/src/features/git/FilesPage.tsx` — Pass git config props down to the tree/table components.

## Suggested Fix
1. Extract the URL-building logic from `FileContextMenu.tsx` into a shared utility (e.g., `buildGitWebUrl(gitWebUrl, gitProvider, defaultBranch, path, isFolder)`).
2. Add an `ExternalLink` icon button in `FileRow.tsx` that calls `window.open(url, '_blank')`.
3. Also add a "Copy Path" icon button inline for quick access without right-click.
