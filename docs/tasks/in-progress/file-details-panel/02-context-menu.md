# Subtask: Context Menu Actions

**Status:** Not Started  
**Effort:** 2 days

---

## Goal

Add right-click context menu to folder tree nodes with quick actions.

---

## Tasks

- [ ] Create `ContextMenu.tsx` component
- [ ] Handle right-click on tree nodes
- [ ] Position menu at cursor

### File Actions
- [ ] 📊 Open Details Panel
- [ ] 🌐 Open in Repository
- [ ] 📜 View Blame
- [ ] 📋 Copy Path
- [ ] 📋 Copy Remote URL
- [ ] 🔗 Show Coupled Files

### Folder Actions
- [ ] 📊 Open Details Panel
- [ ] 🌐 Browse in Repository
- [ ] 📋 Copy Path
- [ ] 🔥 Show Hot Files
- [ ] 🔗 Show Coupling Map

---

## Design

```
┌─────────────────────────────────┐
│ 📄 components/DataTable.tsx     │
├─────────────────────────────────┤
│ 📊 Open Details Panel           │
│ ─────────────────────────────── │
│ 🌐 Open in Repository           │
│ 📜 View Blame                   │
│ 📋 Copy Path                    │
│ 📋 Copy Remote URL              │
│ ─────────────────────────────── │
│ 🔗 Show Coupled Files           │
└─────────────────────────────────┘
```

---

## Relevant Files

- `frontend/src/components/FolderTree.tsx`
- `frontend/src/components/shared/ContextMenu.tsx` (new)
