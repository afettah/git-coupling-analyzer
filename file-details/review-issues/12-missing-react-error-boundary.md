# Issue 12: Missing React Error Boundary

## Severity: HIGH

## Problem
No `ErrorBoundary` component exists anywhere in the frontend. A rendering crash in any feature view (e.g., null reference in a deeply nested component) will white-screen the entire application with no recovery path.

## Expected Behavior
- Top-level `ErrorBoundary` catches rendering errors and shows recovery UI
- Feature-level boundaries isolate crashes per section (dashboard, file details, etc.)
- Users see "Something went wrong" with a retry button, not a blank screen

## Value
App resilience — partial failures don't destroy the entire user experience.

## Concerned Files

| File | Change needed |
|------|--------------|
| `src/frontend/src/App.tsx` | Wrap `<Routes>` with `<ErrorBoundary>` |
| New: `src/frontend/src/components/ErrorBoundary.tsx` | Create component |

## Suggested Changes

```tsx
// src/frontend/src/components/ErrorBoundary.tsx
import React from 'react';

interface State { hasError: boolean; error: Error | null }

export class ErrorBoundary extends React.Component<
  { children: React.ReactNode; fallback?: React.ReactNode },
  State
> {
  state: State = { hasError: false, error: null };

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error('ErrorBoundary caught:', error, info);
  }

  render() {
    if (this.state.hasError) {
      return this.props.fallback || (
        <div className="flex flex-col items-center justify-center min-h-[400px] text-slate-400">
          <h2 className="text-xl font-semibold text-red-400 mb-2">Something went wrong</h2>
          <p className="mb-4">{this.state.error?.message}</p>
          <button
            onClick={() => this.setState({ hasError: false, error: null })}
            className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
          >
            Try again
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
```

Wrap in `App.tsx`:
```tsx
<ErrorBoundary>
  <Routes>...</Routes>
</ErrorBoundary>
```
