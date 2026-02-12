# Issue 05: Polling, Performance, and Scalability Concerns

## Severity: MEDIUM-HIGH

## Problem
- `AnalysisDashboard.tsx` polls every 3s indefinitely, even after analysis completes
- `listFiles` returns all files with no pagination — large repos (>10K files) will choke
- `getAnalysisStatus()` fetches ALL runs then takes `runs[0]`
- Mock progress code is imported unconditionally in production
- No request cancellation causes stale data overwrites

## Expected Behavior
- Polling stops when analysis completes or component unmounts
- File lists use pagination or virtual scrolling with server-side pagination
- Only the latest run is fetched (with `limit=1&sort=created_at:desc`)
- Mock code is behind `import.meta.env.DEV` or removed
- Components are reusable and scalable for large repos

## Value
Reduced server load, faster UI for large repos, no wasted network traffic, cleaner production bundles.

## Concerned Files

| File | Issue |
|------|-------|
| `src/frontend/src/features/dashboard/AnalysisDashboard.tsx` | 3s polling never stops; `setInterval(fetchStatus, 3000)` |
| `src/frontend/src/api/git.ts` | `listFiles` no pagination; `getAnalysisStatus` fetches all runs |
| `src/frontend/src/hooks/useSSE.ts` | Imports `startMockProgressStream` from `mocks/progressMock.ts` unconditionally |
| `src/frontend/src/mocks/progressMock.ts` | 700ms tick — mock code shipped to production |
| `src/frontend/src/features/dashboard/ProjectDashboard.tsx` | Fires 5 parallel fetches with no error isolation |
| `src/platform/code_intel/routers/git.py` | `limit` defaults up to 5000; no max cap enforcement |

## Suggested Changes

### 1. Stop polling when analysis completes
```tsx
useEffect(() => {
  if (status?.state === 'completed' || status?.state === 'failed') return;
  const interval = setInterval(fetchStatus, 3000);
  return () => clearInterval(interval);
}, [status?.state]);
```

### 2. Add server-side pagination to `listFiles`
Frontend: implement `offset`/`limit` params with infinite scroll or pagination controls.
Backend: already supports `limit`/`offset` — just wire it.

### 3. Fix `getAnalysisStatus()` to request `limit=1`

### 4. Gate mock imports behind dev flag
```ts
if (import.meta.env.DEV && url.startsWith('mock://')) {
  const { startMockProgressStream } = await import('../mocks/progressMock');
}
```

### 5. Add error isolation to parallel fetches in ProjectDashboard
Use `Promise.allSettled()` instead of `Promise.all()` so one failure doesn't block others.
