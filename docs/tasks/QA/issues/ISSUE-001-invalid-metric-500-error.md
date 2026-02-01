# ISSUE-001: Invalid Metric Parameter Causes 500 Error

**Severity**: Medium  
**Endpoint**: `GET /repos/{repo_id}/coupling`  
**Status**: Open

## Description

When an invalid `metric` parameter is provided to the coupling endpoint, the API returns an HTTP 500 Internal Server Error instead of a proper HTTP 400 validation error with a helpful message.

## Steps to Reproduce

```bash
curl "http://localhost:8000/repos/openhands/coupling?path=containers/dev/compose.yml&metric=invalid_metric"
```

## Expected Behavior

HTTP 400 response with validation error:
```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Invalid metric: 'invalid_metric'. Valid options are: jaccard, pair_count, p_dst_given_src, p_src_given_dst, jaccard_weighted",
    "details": null
  }
}
```

## Actual Behavior

HTTP 500 response:
```json
{
  "error": {
    "code": "INTERNAL_SERVER_ERROR",
    "message": "An unexpected error occurred",
    "details": null
  }
}
```

## Root Cause

The `metric` parameter is passed directly to the storage layer without validation. When the storage layer attempts to use it in a SQL query, it fails.

## Suggested Fix

Add validation in the `get_coupling` endpoint:

```python
VALID_METRICS = {"jaccard", "pair_count", "p_dst_given_src", "p_src_given_dst", "jaccard_weighted"}

@app.get("/repos/{repo_id}/coupling", response_model=List[CoupledFile])
def get_coupling(
    repo_id: str,
    path: str,
    metric: str = "jaccard",
    min_weight: float = 0.0,
    limit: int = 50,
    current_only: bool = True,
    data_dir: str = "data"
) -> List[CoupledFile]:
    if metric not in VALID_METRICS:
        raise HTTPException(
            status_code=400,
            detail=f"Invalid metric: '{metric}'. Valid options are: {', '.join(sorted(VALID_METRICS))}"
        )
    # ... rest of implementation
```

Or use an Enum in FastAPI:

```python
from enum import Enum

class CouplingMetric(str, Enum):
    jaccard = "jaccard"
    pair_count = "pair_count"
    p_dst_given_src = "p_dst_given_src"
    p_src_given_dst = "p_src_given_dst"
    jaccard_weighted = "jaccard_weighted"

@app.get("/repos/{repo_id}/coupling")
def get_coupling(
    repo_id: str,
    path: str,
    metric: CouplingMetric = CouplingMetric.jaccard,
    ...
):
```

## Impact

- Users get unhelpful error messages when providing invalid parameters
- Makes API integration and debugging more difficult
- Obscures the valid parameter options from API consumers

## Related Files

- `/home/afettah/workspace/git-coupling-analyzer/lfca/api.py` (lines 1265-1292)
