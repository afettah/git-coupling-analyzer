# Task 11: Make Left Sidebar Collapsible

## Issue
The left sidebar navigation is fixed at a width of `w-72` (288px) with a `sidebarCollapsed` variable hardcoded to `false`. There is no toggle button to collapse/expand it.

## Expected Behavior
- The sidebar should have a toggle button (e.g., hamburger icon or chevron) to collapse it to a narrow icon-only mode (~80px / `w-20`).
- The collapsed state should persist (e.g., in localStorage).
- The main content area should adjust its left margin accordingly.

## Root Cause Analysis
In `AnalysisDashboard.tsx` line ~79: `const sidebarCollapsed = false;` is hardcoded. The template already supports collapsed rendering (conditional `w-20` class, icon-only labels with `!sidebarCollapsed`), but the state is never toggled.

## Files to Modify
- `src/frontend/src/features/dashboard/AnalysisDashboard.tsx` — Convert `sidebarCollapsed` from a constant to `useState` with localStorage persistence. Add a toggle button in the sidebar (e.g., at the bottom or top of the sidebar).

## Suggested Fix
1. Replace `const sidebarCollapsed = false;` with:
   ```tsx
   const [sidebarCollapsed, setSidebarCollapsed] = useState(() => {
     return localStorage.getItem('sidebar-collapsed') === 'true';
   });
   ```
2. Add a toggle button at the bottom of the `<aside>`:
   ```tsx
   <button onClick={() => setSidebarCollapsed(prev => { localStorage.setItem('sidebar-collapsed', String(!prev)); return !prev; })}>
     {sidebarCollapsed ? <ChevronsRight /> : <ChevronsLeft />}
   </button>
   ```
3. The existing conditional classes (`sidebarCollapsed ? 'w-20' : 'w-72'`) will automatically handle the layout.
