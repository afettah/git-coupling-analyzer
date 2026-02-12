# Issue 01: Comprehensive Error Handling with Error Codes

## Severity: HIGH

## Problem
Backend routers use bare `except Exception` in 15+ locations, silently returning empty defaults instead of propagating meaningful errors. Frontend lacks React ErrorBoundary. Error codes are inconsistent or missing.

## Expected Behavior
- Every API error returns a structured envelope: `{ code: "ERR_XXX", message: "...", details: {...} }`
- Backend never silently swallows exceptions — always log + return proper HTTP status
- Frontend displays error code + message to users for every failure
- React ErrorBoundary catches rendering crashes with recovery UI

## Value
Users can diagnose and report issues. Silent failures no longer mask data corruption or missing data. App never white-screens.

## Concerned Files

### Backend — Silent `except Exception` blocks
| File | Lines | Current Behavior |
|------|-------|-----------------|
| `src/platform/code_intel/routers/git.py` | 227-250, 381, 405, 807-808 | Returns `[]` or logs warning on any error |
| `src/platform/code_intel/routers/graph.py` | 107, 391-397 | Silent fallback values |
| `src/platform/code_intel/routers/intelligence.py` | 56-66, 104-111, 163-165, 219-226 | Returns empty defaults |
| `src/platform/code_intel/routers/risk.py` | 86-93, 131-133, 163-165 | Silent fallback |
| `src/platform/code_intel/routers/semantic.py` | 107-108 | Returns `[]`, no logging |
| `src/platform/code_intel/routers/analyzers.py` | 51-52, 55-56, 163-164, 217-218 | Silent failures |
| `src/platform/code_intel/routers/repos.py` | 202 | Swallows all errors, returns "error" state |
| `src/platform/code_intel/storage.py` | 47, 52-58 | Generic rollback, silent JSON parse failures |
| `src/platform/code_intel/orchestrator.py` | 68 | Generic exception catch |

### Frontend — Missing error display
| File | Issue |
|------|-------|
| `src/frontend/src/features/settings/SettingsView.tsx` | `handleSave` catch only does `console.error` — no UI feedback |
| `src/frontend/src/features/dashboard/ProjectDashboard.tsx` | Data loading catch logs to console only |
| `src/frontend/src/features/dashboard/AnalysisDashboard.tsx` | `fetchStatus` silently sets null on error |
| `src/frontend/src/App.tsx` | No React ErrorBoundary wrapping the app |
| `src/frontend/src/components/ErrorNotification.tsx` | Uses `bg-red-50` (light theme) in dark-themed app; uses deprecated `substr` |

## Suggested Changes

### 1. Define error code enum (backend)
```python
# src/platform/code_intel/errors.py
class ErrorCode:
    REPO_NOT_FOUND = "ERR_REPO_NOT_FOUND"
    ANALYSIS_NOT_FOUND = "ERR_ANALYSIS_NOT_FOUND"
    CONFIG_INVALID = "ERR_CONFIG_INVALID"
    STORAGE_READ_FAILED = "ERR_STORAGE_READ"
    STORAGE_WRITE_FAILED = "ERR_STORAGE_WRITE"
    GIT_OPERATION_FAILED = "ERR_GIT_OP"
    ANALYZER_NOT_FOUND = "ERR_ANALYZER_NOT_FOUND"
    VALIDATION_FAILED = "ERR_VALIDATION"
    INTERNAL_ERROR = "ERR_INTERNAL"
    PARAM_INVALID = "ERR_PARAM_INVALID"
```

### 2. Replace silent catches with HTTPException
```python
# Before (git.py:807)
except Exception:
    return []

# After
except Exception as e:
    logger.exception("Failed to list clustering snapshots")
    raise HTTPException(status_code=500, detail={
        "code": ErrorCode.STORAGE_READ_FAILED,
        "message": "Failed to list clustering snapshots",
        "details": str(e)
    })
```

### 3. Add React ErrorBoundary (frontend)
```tsx
// src/frontend/src/components/ErrorBoundary.tsx
class ErrorBoundary extends React.Component<Props, State> {
  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }
  render() {
    if (this.state.hasError) {
      return <ErrorRecoveryUI error={this.state.error} onRetry={() => this.setState({ hasError: false })} />;
    }
    return this.props.children;
  }
}
```

### 4. Fix ErrorNotification dark theme
```tsx
// Change bg-red-50 → bg-red-900/80, text colors to light variants
// Change .substr() → .substring()
```

### 5. Add user-visible error feedback in SettingsView, ProjectDashboard, AnalysisDashboard
Replace `console.error` with `setError(message)` state and render `<ErrorBanner>`.
