# Issue 06: Stub Analyzer Implementations (dep, semantic, intelligence)

## Severity: MEDIUM

## Problem
Three of four analyzer plugins are complete stubs returning hardcoded empty data:
- `dep-analyzer`: all methods return `[]` or `{}`
- `semantic-analyzer`: all methods return `[]` or `{}`
- `project-intelligence`: all methods return `[]` or `{}`

Frontend has full feature views (DepsLayout, SemanticLayout, RiskLayout, KnowledgeGraph) that render empty states because backend returns nothing.

## Expected Behavior
At minimum:
- Stub endpoints should return HTTP 501 (Not Implemented) with a clear message
- Frontend should detect 501 and show "Feature coming soon" instead of empty tables
- `validate_config()` in stubs should actually validate required fields

## Value
Users understand what's implemented vs. planned. No confusion from empty dashboards. Clear API contract for future implementors.

## Concerned Files

### Backend stubs
| File | Issue |
|------|-------|
| `src/dep-analyzer/dep_analyzer/api.py` | All methods return empty |
| `src/dep-analyzer/dep_analyzer/plugin.py` | `analyze()` returns SUCCESS with 0 entities |
| `src/semantic-analyzer/semantic_analyzer/api.py` | All methods return empty |
| `src/semantic-analyzer/semantic_analyzer/plugin.py` | `analyze()` returns SUCCESS with 0 entities |
| `src/project-intelligence/project_intel/api.py` | All methods return empty |
| `src/project-intelligence/project_intel/plugin.py` | `analyze()` returns SUCCESS with 0 entities |

### Frontend feature views consuming stubs
| File | Renders |
|------|---------|
| `src/frontend/src/features/deps/DepsLayout.tsx` | Dependency analysis views |
| `src/frontend/src/features/semantic/SemanticLayout.tsx` | Semantic domain views |
| `src/frontend/src/features/risk/RiskLayout.tsx` | Risk analysis views |
| `src/frontend/src/features/graph/KnowledgeGraph.tsx` | Cross-analyzer graph |

## Suggested Changes

### 1. Return 501 from stub APIs
```python
# In each stub api.py method:
def list_domains(self, repo_id, **kwargs):
    raise NotImplementedError("Semantic analysis not yet implemented")
```

### 2. In routers, catch NotImplementedError → 501
```python
except NotImplementedError as e:
    raise HTTPException(status_code=501, detail={
        "code": "ERR_NOT_IMPLEMENTED",
        "message": str(e)
    })
```

### 3. Frontend: detect 501 and show "Coming soon" banner
```tsx
if (error?.status === 501) {
  return <ComingSoonBanner feature="Dependency Analysis" />;
}
```
