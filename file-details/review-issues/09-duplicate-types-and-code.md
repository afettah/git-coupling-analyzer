# Issue 09: Duplicate Type Definitions and Code Duplication

## Severity: MEDIUM

## Problem
1. TypeScript types defined in both `api/*.ts` and `types/*.ts` with diverging shapes
2. Backend `git.py` repeats date validation + granularity filtering in 4 endpoints
3. Hardcoded data_dir="data" repeated in every router function

## Expected Behavior
- Single source of truth for every type definition
- Shared utility functions for repeated patterns
- Data dir injected via dependency injection

## Value
Eliminates drift between duplicate definitions. Reduces maintenance burden. Makes schema changes safe.

## Concerned Files

### Duplicate frontend types
| API file types | Canonical types/ file | Divergence |
|---------------|----------------------|------------|
| `src/frontend/src/api/risk.ts` | `src/frontend/src/types/risk.ts` | Missing `critical` severity in API |
| `src/frontend/src/api/deps.ts` | `src/frontend/src/types/deps.ts` | Extra fields in types/ |
| `src/frontend/src/api/analyzers.ts` | `src/frontend/src/types/analyzer.ts` | Duplicate `AnalyzerInfo`, `TaskStatus` |
| `src/frontend/src/api/graph.ts` | `src/frontend/src/types/graph.ts` | Duplicate entity/graph types |

### Backend code duplication
| File | Lines | Pattern |
|------|-------|---------|
| `src/platform/code_intel/routers/git.py` | 426-450, 462-489, 572-599, 608-636 | Date validation + granularity filter repeated 4x |
| All router files | Every function | `data_dir = "data"` or `RepoPaths(...)` construction repeated |

## Suggested Changes

### 1. Delete duplicate types from `api/*.ts`, import from `types/`

### 2. Extract date/granularity validation to shared dependency
```python
# src/platform/code_intel/routers/dependencies.py
def parse_date_range(since: str = None, until: str = None) -> tuple[datetime, datetime]:
    ...
def validate_granularity(granularity: str) -> str:
    ...
```

### 3. Inject data_dir via FastAPI dependency
```python
def get_data_dir() -> str:
    return os.environ.get("CODE_INTEL_DATA_DIR", "data")

@router.get("/files")
def list_files(data_dir: str = Depends(get_data_dir)):
    ...
```
