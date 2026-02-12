# Issue 02: Missing Parameter Validation Across All Routers

## Severity: HIGH

## Problem
20+ numeric/string query parameters lack validation. Invalid values pass through to SQL queries or produce unexpected results. No `sort_by`, `order`, `status`, `granularity` values are validated against allowed sets.

## Expected Behavior
Every exposed parameter is either enforced with a valid range/set or rejected with an explicit validation error (HTTP 422) including the parameter name, expected range, and received value.

## Value
Prevents corrupted queries, SQL errors leaking to users, and unexpected behavior. Gives clear feedback on misconfigured API calls.

## Concerned Files

### Missing numeric range validation
| File | Parameter | Issue |
|------|-----------|-------|
| `src/platform/code_intel/routers/git.py` | `limit` (lines 37,52,78,106,152,173,197,264,287) | Defaults vary (50-5000), no max cap |
| `src/platform/code_intel/routers/git.py` | `sort_by` (line 277) | Not validated against allowed column set |
| `src/platform/code_intel/routers/git.py` | `sort_dir` (line 264) | Accepts any string, should be `asc`/`desc` |
| `src/platform/code_intel/routers/risk.py` | `min_risk`, `max_risk` (line 101) | Should be 0.0–1.0 range |
| `src/platform/code_intel/routers/risk.py` | `sort_by` (line 104), `order` (line 105) | Not validated against allowed set |
| `src/platform/code_intel/routers/semantic.py` | `limit`, `min_similarity`, `min_domains` (lines 40,72) | No range validation |
| `src/platform/code_intel/routers/graph.py` | `limit`, `max_depth`, `max_length` (lines 39,149,197,266) | Could be negative |
| `src/platform/code_intel/routers/intelligence.py` | `min_git_coupling`, `min_semantic_similarity` (line 173) | Accept negative values |
| `src/platform/code_intel/routers/deps.py` | `min_imports` (line 13) | No range validation |
| `src/platform/code_intel/routers/analyzers.py` | `status` filter (line 128-131) | Not validated against allowed states |

### Missing string/format validation
| File | Parameter | Issue |
|------|-----------|-------|
| `src/platform/code_intel/routers/repos.py` | `repo_id` | No format/length validation |
| `src/platform/code_intel/routers/repos.py` | `path` | No symlink/directory traversal protection |
| `src/platform/code_intel/routers/git.py` | Date params (lines 426-468, 572-614) | Only validated on exception, not proactively |
| `src/platform/code_intel/routers/git.py` | `granularity` | Repeated in 4 endpoints, not centralized |

### Missing config validation
| File | Issue |
|------|-------|
| `src/platform/code_intel/storage.py` | No validation of `analyzer_type`, config JSON structure, entity IDs before FK ops |
| `src/platform/code_intel/routers/analysis.py` | No validation of `config_id` format, `preset_id` existence, include/exclude as valid patterns |
| `src/git-analyzer/git_analyzer/config.py` | No range validation for `decay_half_life_days`, `window_days` |

## Suggested Changes

### 1. Create shared validation utilities
```python
# src/platform/code_intel/validation.py
from fastapi import Query
from enum import Enum

class SortDir(str, Enum):
    asc = "asc"
    desc = "desc"

class Granularity(str, Enum):
    daily = "daily"
    weekly = "weekly"
    monthly = "monthly"
    quarterly = "quarterly"

def validated_limit(default: int = 50, max_val: int = 5000) -> int:
    return Query(default, ge=1, le=max_val, description=f"Results limit (1-{max_val})")

def validated_offset(default: int = 0) -> int:
    return Query(default, ge=0, description="Results offset")

def validated_ratio(name: str, default: float = 0.0) -> float:
    return Query(default, ge=0.0, le=1.0, description=f"{name} (0.0-1.0)")
```

### 2. Use FastAPI Enum types for constrained string params
```python
# Before
sort_dir: str = Query("desc")

# After
sort_dir: SortDir = Query(SortDir.desc)
```

### 3. Add Pydantic validators on config models
```python
@field_validator('decay_half_life_days')
def validate_decay(cls, v):
    if v <= 0:
        raise ValueError("decay_half_life_days must be positive")
    return v
```

### 4. Centralize granularity/date validation
Extract the repeated date-range + granularity logic into a shared dependency function used by all 4 endpoints in `git.py`.
