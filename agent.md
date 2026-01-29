# Agent Guide

## ⚠️ Before You Start Coding

**For complex tasks or new features:**
1. Use the **Task Management** skill below to create/update a task file
2. Reference the task path in code comments when relevant
3. Update the task status when work is complete

**Skip task management for:** Quick fixes, small changes, or simple questions.

---

## Skills

### Task Management

Create and track work in `docs/tasks/`.

| Action | How |
|--------|-----|
| Create task | Create file: `docs/tasks/YYYYMMDD-task-name.md` |
| Update task | Edit existing task file with progress/status |
| Reference in code | Add comment: `// Task: docs/tasks/YYYYMMDD-task-name.md` |

**Task file format:**
```markdown
# Task Name

**Status:** planning | in-progress | done | blocked
**Created:** YYYY-MM-DD

## Goal
Brief description of what needs to be done.

## Progress
- [ ] Step 1
- [ ] Step 2

## Notes
Any relevant context or decisions.
```

---

### Component & Hook Generation

| Task | Command |
|------|---------|
| New component | `./scripts/generate-component.sh Name [location]` |
| New hook | `./scripts/generate-hook.sh useName` |

---

### Frontend Development

| Need | Use |
|------|-----|
| Animations | Framer Motion (`motion.div`, `AnimatePresence`) |
| Icons | `lucide-react` |
| Styling | Tailwind: `slate-*` (neutral), `sky-*` (accent) |
| Design tokens | `@/design-tokens` for colors, spacing |

---

## Project Structure

```
docs/tasks/           # Task tracking (YYYYMMDD-task-name.md)
frontend/src/
├── components/
│   ├── shared/       # Reusable primitives
│   └── [feature]/    # Domain components
├── hooks/            # Custom hooks
└── design-tokens/    # Theme values
lfca/                 # Python backend
├── api.py            # FastAPI endpoints
├── cli.py            # CLI commands
└── clustering/       # Clustering algorithms
```

## Quick Reference

- **Backend**: FastAPI in `lfca/api.py`
- **CLI**: `lfca/cli.py`
- **Clustering**: `lfca/clustering/` (algorithms in registry)
- **Frontend API calls**: `frontend/src/api.ts`
- **Tasks**: `docs/tasks/` (format: `YYYYMMDD-task-name.md`)
