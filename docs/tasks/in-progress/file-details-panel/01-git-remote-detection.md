# Subtask: Git Remote Auto-Detection

**Status:** Not Started  
**Effort:** 2 days

---

## Goal

Auto-detect git remote URL during project creation and store provider config.

---

## Tasks

- [ ] Add remote detection to project creation flow:
  ```bash
  git -C /path/to/repo remote get-url origin
  ```

- [ ] Store in `repo_meta` table:
  - `git_remote_url` — Original remote URL
  - `git_web_url` — Transformed web URL
  - `git_provider` — Detected provider (github, gitlab, azure_devops, bitbucket)
  - `git_default_branch` — Default branch name

- [ ] Create URL transformation rules:
  | Git Remote | Web URL |
  |------------|---------|
  | `git@github.com:org/repo.git` | `https://github.com/org/repo` |
  | `git@gitlab.com:org/repo.git` | `https://gitlab.com/org/repo` |
  | Azure DevOps SSH | `https://dev.azure.com/org/project/_git/repo` |

- [ ] Create URL builder utility:
  | Provider | File URL | Commit URL |
  |----------|----------|------------|
  | GitHub | `{base}/blob/{branch}/{path}` | `{base}/commit/{sha}` |
  | GitLab | `{base}/-/blob/{branch}/{path}` | `{base}/-/commit/{sha}` |
  | Azure DevOps | `{base}?path=/{path}` | `{base}/commit/{sha}` |

- [ ] Add settings UI for manual configuration

---

## Relevant Files

- `lfca/git.py`
- `lfca/storage.py`
- `frontend/src/components/CreateRepoModal.tsx`
