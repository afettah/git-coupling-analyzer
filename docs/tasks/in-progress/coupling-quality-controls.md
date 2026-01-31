# Task: Coupling Quality Controls

**Status:** Partially Implemented  
**Priority:** High  
**Last Updated:** January 31, 2026

---

## Summary

Reduce noise from generated files, lock files, and bulk changes in coupling analysis.

---

## What Has Been Done

- ✅ `max_changeset_size` configuration (filters bulk commits)
- ✅ Skip logic in `lfca/extract.py` line 71
- ✅ Design document with IgnoreManager spec

---

## What Needs To Be Done

### Backend (lfca/)

- [ ] Add to `CouplingConfig`:
  - `min_loc` — Minimum lines of code
  - `min_file_size` — Minimum file size in bytes
  - `ignore_patterns` — gitignore-style patterns
  - `ignored_extensions` — List of extensions to skip

- [ ] Create `IgnoreManager` class:
  - Load `.gitignore` from repo root
  - Load `.lfcaignore` from repo root
  - Merge with config patterns
  - `is_ignored(path) -> bool` method

- [ ] Integrate into extraction loop

- [ ] File size/LOC filters during sync phase:
  - Compute size and LOC at HEAD
  - Add `is_valid` flag to files table

### Frontend (frontend/)

- [ ] Ignore preview in `CreateRepoModal.tsx`
- [ ] Language template preset selector (Python, C#, etc.)
- [ ] Quick exclude list in clustering config

### API

- [ ] `GET /repos/{id}/ignore-status` — Current ignore rules
- [ ] `POST /repos/{id}/preview-patterns` — Preview what would be ignored

---

## Relevant Files

- [lfca/config.py](../../../lfca/config.py)
- [lfca/extract.py](../../../lfca/extract.py)
- [frontend/src/components/CreateRepoModal.tsx](../../../frontend/src/components/CreateRepoModal.tsx)
