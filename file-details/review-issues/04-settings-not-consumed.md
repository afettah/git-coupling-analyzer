# Issue 04: Settings Configuration Saved But Not Consumed

## Severity: MEDIUM

## Problem
`SettingsView.tsx` exposes 6 settings sections (Analysis, Git Integration, Performance, Display, Notifications, Keyboard Shortcuts). Values are saved to `localStorage` but never read back or consumed by the app.

## Expected Behavior
- `displaySettings.theme` switches between dark/light/system
- `displaySettings.compactMode` toggles compact layout
- `displaySettings.dateFormat` is used for all date rendering
- `displaySettings.defaultView` controls initial route after login
- `performanceSettings.enableAnimations` disables Framer Motion
- `notificationSettings` triggers actual notifications on analysis events
- Settings load on app startup and propagate to consuming components

## Value
Users can actually customize the app behavior. Currently the settings panel is a dead-end — changing values has zero effect on the application.

## Concerned Files

| File | Issue |
|------|-------|
| `src/frontend/src/features/settings/SettingsView.tsx` | Saves to localStorage, never propagates |
| `src/frontend/src/App.tsx` | Hardcoded dark theme classes, always redirects to `/repos` |
| All components with `bg-slate-950`, `text-slate-50` | Hardcoded dark theme, ignores `theme` setting |
| All components using dates | No date formatting with user preference |

## Suggested Changes

### 1. Create a SettingsContext provider
```tsx
// src/frontend/src/contexts/SettingsContext.tsx
const SettingsContext = createContext<Settings>(defaultSettings);
export const SettingsProvider = ({ children }) => {
  const [settings] = useLocalStorage('app-settings', defaultSettings);
  return <SettingsContext.Provider value={settings}>{children}</SettingsContext.Provider>;
};
export const useSettings = () => useContext(SettingsContext);
```

### 2. Consume settings in App.tsx
- Apply `theme` class to root element (`dark`/`light`)
- Use `defaultView` for initial redirect
- Wrap with `<SettingsProvider>`

### 3. Use `dateFormat` in a shared `formatDate()` utility

### 4. Gate animations behind `enableAnimations` setting

### 5. Either implement notification triggers or remove the notifications section with a "Coming soon" label to avoid confusion
