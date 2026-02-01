# Subtask: Context Menu Actions

**Status:** ✅ Complete  
**Effort:** 2 days

---

## Goal

Add right-click context menu to folder tree nodes with quick actions.

---

## Tasks

- [x] Create `ContextMenu.tsx` component
- [x] Handle right-click on tree nodes
- [x] Position menu at cursor

### File Actions
- [x] 📊 Open Details Panel
- [ ] 🌐 Open in Repository (needs git remote detection)
- [ ] 📜 View Blame (needs git remote detection)
- [x] 📋 Copy Path
- [ ] 📋 Copy Remote URL (needs git remote detection)
- [x] 🔗 Show Coupled Files

### Folder Actions
- [x] 📊 Open Details Panel
- [ ] 🌐 Browse in Repository (needs git remote detection)
- [x] 📋 Copy Path
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
