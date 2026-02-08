# Task 02 - Tree Browse + Live Preview API

## Objective

Implement tree browsing and filter preview APIs backed by `project_tree`, with deterministic tri-state semantics.

## Dependencies

1. Task 01.

## Detailed Implementation

## 1) Create router `src/platform/code_intel/routers/tree.py`

### Endpoints

1. `GET /repos/{repo_id}/tree`
2. `POST /repos/{repo_id}/tree/preview`

### Browse request params

1. `path` (root path)
2. `depth` (max depth from root)
3. `include_files` (dirs-only or dirs+files)

### Preview request body

```json
{
  "include_paths": ["src/**"],
  "exclude_paths": ["src/generated/**"],
  "include_extensions": [".py", ".ts"],
  "exclude_extensions": [".min.js"],
  "preset": "react",
  "max_depth": 6
}
```

## 2) SQL filtering strategy

Base query:

```sql
SELECT path, name, kind, extension, language, depth, parent_path
FROM project_tree
WHERE depth <= :max_depth
ORDER BY CASE kind WHEN 'dir' THEN 0 ELSE 1 END, path;
```

Then apply matcher precedence in Python:

1. explicit exclude path/extension wins.
2. include rules decide inclusion when not explicitly excluded.
3. directory status derived from children (`partial` if mixed).

## 3) Tree assembly

Pseudocode:

```python
nodes = {r.path: Node(...)}
roots = []
for n in nodes.values():
    if n.parent_path and n.parent_path in nodes:
        nodes[n.parent_path].children.append(n)
    else:
        roots.append(n)

postorder(roots, assign_status)
```

## 4) Storage additions

In `storage.py` add:

1. `browse_project_tree(path, depth, include_files)`
2. `fetch_tree_rows_for_preview(max_depth)`

## 5) Frontend API client

Create `src/frontend/src/api/tree.ts` with typed request/response models.

## Verification Matrix

1. Browse returns stable order and consistent hierarchy.
2. Preview statuses match include/exclude precedence.
3. Partial directories appear when mixed descendants exist.
4. Performance remains acceptable with indexed queries.

## Definition of Done

1. `/tree` and `/tree/preview` are stable, typed, and deterministic.
2. No live git command is used in preview path.

## Files To Touch

1. `src/platform/code_intel/routers/tree.py`
2. `src/platform/code_intel/storage.py`
3. `src/platform/code_intel/app.py`
4. `src/frontend/src/api/tree.ts`

