# Issue 08: Hardcoded Values That Should Be Configurable

## Severity: LOW-MEDIUM

## Problem
Many magic numbers and strings scattered across backend and frontend. These reduce configurability and make the system harder to tune per-deployment.

## Expected Behavior
All tunable values centralized in config objects or environment variables.

## Value
Easier deployment tuning, no code changes needed for different environments.

## Concerned Files

### Backend
| File | Value | Should be |
|------|-------|-----------|
| `src/platform/code_intel/app.py` | CORS origins `"http://localhost:5173,http://localhost:4173"` | Env var (has fallback ✓, but default too narrow) |
| `src/platform/code_intel/app.py` | Version `"2.0"` | Read from `pyproject.toml` or env |
| `src/platform/code_intel/routers/git.py` | Limit defaults (50, 200, 500, 5000) | Config constant or per-deployment setting |
| `src/platform/code_intel/routers/risk.py` | Risk weights (0.4, 0.3, 0.2, 0.1) | Config or per-project setting |
| `src/platform/code_intel/routers/risk.py` | Risk buckets ("0-0.2", "0.2-0.4"...) | Config |
| `src/platform/code_intel/routers/repos.py` | Default branch `"main"` | Detect from repo or config |
| `src/platform/code_intel/orchestrator.py` | Task ID length `hex[:12]` | Named constant |
| `src/platform/code_intel/schema.py` | `SCHEMA_VERSION = 3` | Checked at startup |
| `src/git-analyzer/git_analyzer/changesets.py` | 3600, 86400 magic numbers | Named constants `SECONDS_PER_HOUR`, `SECONDS_PER_DAY` |
| `src/platform/code_intel/routers/analyzers.py` | Hardcoded analyzer descriptions dict | Move to plugin metadata |

### Frontend
| File | Value | Should be |
|------|-------|-----------|
| `src/frontend/src/api/client.ts` | `http://localhost:8000` | Env var via `import.meta.env.VITE_API_URL` |
| `src/frontend/src/features/settings/SettingsView.tsx` | Default branch `'main'` | Use detected value from scan |
| `src/frontend/src/features/wizard/ProjectWizard.tsx` | Default include patterns `'src/*\ntests/*'` | Use scan-recommended patterns |
| `src/frontend/src/features/wizard/ProjectWizard.tsx` | Default exclude patterns `'node_modules/*\ndist/*\ncoverage/*'` | Use scan-recommended patterns |
| `src/frontend/src/features/dashboard/AnalysisDashboard.tsx` | 3s polling interval | Config constant |
| `src/frontend/src/hooks/useSSE.ts` | `maxReconnectDelayMs = 8000` | Config constant |

## Suggested Changes

### 1. Backend: create `defaults.py` config module
```python
class Defaults:
    MAX_LIMIT = 5000
    DEFAULT_LIMIT = 50
    TASK_ID_LENGTH = 12
    RISK_WEIGHTS = {"coupling": 0.4, "churn": 0.3, "complexity": 0.2, "age": 0.1}
    SECONDS_PER_HOUR = 3600
    SECONDS_PER_DAY = 86400
```

### 2. Frontend: use environment variables and centralized config
```ts
// Already has uiConfig.ts — extend it with API and polling defaults
export const apiConfig = {
  baseUrl: import.meta.env.VITE_API_URL || 'http://localhost:8000',
  pollingIntervalMs: 3000,
  maxReconnectDelayMs: 8000,
};
```

### 3. Move analyzer descriptions to plugin metadata
Each plugin should expose `description` and `display_name` in its `BaseAnalyzer` implementation.
