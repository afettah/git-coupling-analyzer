# Issue 03: Front-Back Integration Gaps

## Severity: MEDIUM-HIGH

## Problem
Several backend endpoints are not called from the frontend. Response type mappings use `any` casts defeating TypeScript safety. Manual field remapping is fragile. No request cancellation on navigation.

## Expected Behavior
- Every backend endpoint used by a feature has a typed frontend API function
- Response types match backend schemas exactly (no manual remapping with `any`)
- Rapid navigation cancels in-flight requests via AbortController
- All intelligence endpoints are wired to frontend views

## Value
Type safety catches schema drift at compile time. Request cancellation prevents stale data. Full endpoint coverage enables all planned features.

## Concerned Files

### Untyped API responses (`any` returns)
| File | Function | Line |
|------|----------|------|
| `src/frontend/src/api/git.ts` | `getFileTree()` | 546-547 |
| `src/frontend/src/api/git.ts` | `getCouplingGraph()` | 651-653 |
| `src/frontend/src/api/git.ts` | `getComponentCoupling()` | 656-659 |
| `src/frontend/src/api/git.ts` | `getImpact/getImpactGraph/getLineage` | 797-801 |

### Manual `any` cast field remapping
| File | Functions | Lines |
|------|-----------|-------|
| `src/frontend/src/api/git.ts` | `getDashboardSummary`, `getDashboardTrends`, `getHotspots`, `getTimeline` | 703-786 |

### Duplicate type definitions (diverging shapes)
| Frontend API types | Frontend `types/` types | Drift risk |
|-------------------|------------------------|------------|
| `src/frontend/src/api/risk.ts` (severity: `high\|medium\|low`) | `src/frontend/src/types/risk.ts` (severity: `critical\|high\|medium\|low`) | Missing `critical` level in API |
| `src/frontend/src/api/deps.ts` | `src/frontend/src/types/deps.ts` | Extra fields in types/ |
| `src/frontend/src/api/analyzers.ts` | `src/frontend/src/types/analyzer.ts` | Duplicate `AnalyzerInfo`, `TaskStatus`, `TaskResult` |
| `src/frontend/src/api/graph.ts` | `src/frontend/src/types/graph.ts` | Duplicate entity/graph types |

### Missing frontend calls for backend endpoints
| Backend endpoint | Router file | Status |
|-----------------|-------------|--------|
| `GET /repos/{id}/intelligence/risk/overview` | `intelligence.py` | Not called from frontend |
| `GET /repos/{id}/intelligence/risk/entities/{id}` | `intelligence.py` | Not called from frontend |
| `GET /repos/{id}/intelligence/graph` | `intelligence.py` | Not called from frontend |

### No request cancellation
| File | Issue |
|------|-------|
| All files in `src/frontend/src/api/` | No AbortController usage anywhere |

### `git.ts` semantic issues
| File | Lines | Issue |
|------|-------|-------|
| `src/frontend/src/api/git.ts` | 503-507 | `getGitInfo/updateGitInfo` use `/repos/{id}/git-info` — belongs in `repos.ts`, not `git.ts` |
| `src/frontend/src/api/git.ts` | 509-520 | `startAnalysis()` hardcodes `name: 'Adhoc ...'`, `is_active: true` — may clobber user config |
| `src/frontend/src/api/git.ts` | 522-543 | `getAnalysisStatus()` takes `runs[0]` with no sort guarantee |

## Suggested Changes

### 1. Consolidate types — single source of truth in `types/`
Delete duplicate type definitions from `api/*.ts` files. Import from `types/` everywhere.

### 2. Add generics to all untyped API calls
```ts
// Before
export const getFileTree = (repoId: string, ...) => client.get(`...`);
// After
export const getFileTree = (repoId: string, ...): Promise<FileTreeNode[]> => client.get<FileTreeNode[]>(`...`);
```

### 3. Add AbortController support to client
```ts
// src/frontend/src/api/client.ts
export const client = {
  get: <T>(url: string, params?: any, signal?: AbortSignal): Promise<T> => {
    return axios.get(url, { params, signal }).then(r => r.data);
  }
};
```

### 4. Wire intelligence endpoints to frontend
Add calls in `src/frontend/src/api/intelligence.ts` for the 3 missing endpoints and consume them in the intelligence feature views.

### 5. Move `getGitInfo`/`updateGitInfo` to `repos.ts`

### 6. Fix `getAnalysisStatus()` to sort runs by `created_at desc` before taking first.
