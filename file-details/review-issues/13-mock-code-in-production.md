# Issue 13: Mock Code Shipped to Production Bundle

## Severity: MEDIUM

## Problem
`useSSE.ts` unconditionally imports `startMockProgressStream` from `mocks/progressMock.ts`. This mock module (with its 700ms tick interval) is included in the production build, increasing bundle size and creating a potential execution path for fake data.

## Expected Behavior
Mock code is only available in development builds via `import.meta.env.DEV` guard or dynamic import.

## Value
Smaller production bundle, no risk of mock data leaking into real usage.

## Concerned Files

| File | Issue |
|------|-------|
| `src/frontend/src/hooks/useSSE.ts` | Imports mock module unconditionally |
| `src/frontend/src/mocks/progressMock.ts` | Included in production bundle |

## Suggested Changes

```ts
// useSSE.ts — replace static import with dynamic
if (import.meta.env.DEV && url.startsWith('mock://')) {
  const { startMockProgressStream } = await import('../mocks/progressMock');
  // use mock
}
```

Or use Vite's `define` to tree-shake in production.
