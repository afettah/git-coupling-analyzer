# Task 10 - Repos API Redesign (Create + Scan)

## Objective

Redesign repo creation and scan lifecycle APIs so onboarding immediately provides scan intelligence and state-aware behavior.

## Dependencies

1. Task 01.

## Detailed Implementation

## 1) Rewrite create behavior in `routers/repos.py`

Current create path:

1. validates path/git
2. stores metadata
3. returns `state=not_started`

Target create path:

1. validate path/git
2. create repo metadata
3. trigger scan automatically
4. return `ready/scanning/error` + optional scan summary

## 2) New scan endpoints

1. `POST /repos/{repo_id}/scan` (manual rescan)
2. `GET /repos/{repo_id}/scan` (latest summary/state)

## 3) Sync vs async scan heuristic

Pseudocode:

```python
estimated_files = quick_count_head_files(repo_path)
if estimated_files > 50_000:
    enqueue_scan(repo_id)
    state = "scanning"
else:
    run_scan_now(repo_id)
    state = "ready"
```

## 4) Response contracts

Create response:

```json
{
  "id": "repo_1",
  "name": "my-project",
  "state": "ready",
  "scan": {
    "scan_id": "scan_1",
    "total_files": 12450,
    "total_dirs": 915,
    "commit_count": 45200,
    "languages": {"python": 342, "typescript": 128}
  }
}
```

Scan status response:

```json
{
  "repo_id": "repo_1",
  "state": "scanning",
  "scan": null,
  "error": null
}
```

## 5) Frontend API update

Update `src/frontend/src/api/repos.ts` with scan-aware types and helpers.

## Verification Matrix

1. invalid/non-git path gives clear 4xx.
2. small repo returns ready + scan.
3. large repo returns scanning and later resolves.
4. manual rescan replaces latest scan snapshot.

## Definition of Done

1. repo lifecycle is scan-aware.
2. wizard can rely on create/scan APIs without workarounds.

## Files To Touch

1. `src/platform/code_intel/routers/repos.py`
2. `src/platform/code_intel/storage.py`
3. `src/git-analyzer/git_analyzer/scanner.py`
4. `src/frontend/src/api/repos.ts`

