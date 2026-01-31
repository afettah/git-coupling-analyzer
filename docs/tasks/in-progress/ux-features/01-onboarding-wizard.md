# Subtask: Onboarding Wizard

**Status:** Not Started  
**Priority:** Medium  
**Effort:** 3 days

---

## Goal

Create a multi-step onboarding wizard for first-time users to understand what LFCA does and how to get started.

---

## Tasks

- [ ] Create `frontend/src/components/onboarding/` directory
- [ ] Create `OnboardingWizard.tsx` component
- [ ] Create `useOnboarding.ts` hook with localStorage persistence
- [ ] Implement wizard steps:
  1. **Welcome** — Explain coupling concept with animated diagram
  2. **Connect** — Repository path input with validation
  3. **Analyze** — Progress display with explanations
  4. **Explore** — Highlight key findings with annotations
- [ ] Add onboarding check to `App.tsx`
- [ ] Store completion state in localStorage

---

## Design

```
┌─────────────────────────────────────────────────────────────────┐
│  Welcome to LFCA!                                      Step 1/4 │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  🎯 What is Logical Coupling?                                    │
│                                                                  │
│  Files that frequently change together in commits often have     │
│  hidden dependencies. LFCA helps you discover these patterns.    │
│                                                                  │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │  auth.py ←──────────────────→ user_service.py           │    │
│  │     ↑         "Always change together"        ↑          │    │
│  │     └──────────────→ session.py ←─────────────┘          │    │
│  └─────────────────────────────────────────────────────────┘    │
│                                                                  │
│                                        [Skip] [Next →]           │
└─────────────────────────────────────────────────────────────────┘
```

---

## Relevant Files

- `frontend/src/App.tsx`
- `frontend/src/components/onboarding/` (new)
