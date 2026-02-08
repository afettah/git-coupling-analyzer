# Task 01 - Schema + Project Scan Foundation

## Objective

Build the data foundation for parametrable analysis:

1. Persist project scan intelligence.
2. Persist query-optimized project tree.
3. Persist reusable analysis configs.
4. Link analysis runs to configs.

## Scope

1. `schema.py` migration-safe updates.
2. scanner service (`scanner.py`).
3. storage methods for scan/tree/config.
4. typed config/presets modules.

## Dependencies

1. None.

## Detailed Implementation

## 1) Schema updates in `src/platform/code_intel/schema.py`

### Required DDL

```sql
CREATE TABLE IF NOT EXISTS project_scan (...);
CREATE TABLE IF NOT EXISTS project_tree (...);
CREATE TABLE IF NOT EXISTS analysis_configs (...);
```

### Required fixes

```sql
DROP INDEX IF EXISTS idx_entities_qualified;
CREATE UNIQUE INDEX IF NOT EXISTS idx_entities_qualified
  ON entities(qualified_name, kind)
  WHERE qualified_name IS NOT NULL;

ALTER TABLE analysis_tasks ADD COLUMN config_id TEXT;
```

### Migration safety

Pseudocode:

```python
def has_column(conn, table, column):
    rows = conn.execute(f"PRAGMA table_info({table})").fetchall()
    return any(r[1] == column for r in rows)

if not has_column(conn, "analysis_tasks", "config_id"):
    conn.execute("ALTER TABLE analysis_tasks ADD COLUMN config_id TEXT")
```

## 2) Scanner service in `src/git-analyzer/git_analyzer/scanner.py`

### Commands

```bash
git -C <repo> ls-tree -r --name-only HEAD
git -C <repo> rev-list --count HEAD
git -C <repo> log --format='%ae' | sort -u | head -200
git -C <repo> log --format='%at' --reverse -1
git -C <repo> log --format='%at' -1
```

### Service contract

```python
class ProjectScanner:
    def scan(self, repo_path: Path, storage: Storage) -> ScanResult: ...
```

### Core algorithm

1. Read file paths.
2. Build directory nodes.
3. Infer extensions/languages.
4. Detect framework markers.
5. Save one `project_scan` row + replace `project_tree` rows atomically.

Pseudocode:

```python
with storage.transaction():
    storage.save_project_scan(scan_row)
    storage.replace_project_tree(scan_id, tree_rows)
```

## 3) Storage methods in `src/platform/code_intel/storage.py`

Add:

1. `save_project_scan`
2. `get_latest_project_scan`
3. `replace_project_tree`
4. `browse_project_tree`
5. `create_analysis_config`
6. `get_analysis_config`
7. `list_analysis_configs`

## 4) Typed config and presets

Create:

1. `src/git-analyzer/git_analyzer/analysis_config.py`
2. `src/git-analyzer/git_analyzer/presets.py`

Preset example:

```python
PRESETS = {
  "react": {
    "include_extensions": [".ts", ".tsx", ".js", ".jsx"],
    "exclude_paths": ["node_modules/**", "dist/**", "build/**"]
  },
  "dotnet": {
    "include_extensions": [".cs", ".csproj", ".sln"],
    "exclude_paths": ["bin/**", "obj/**"]
  }
}
```

## Verification Matrix

1. DB init creates all new tables/indexes.
2. Existing DB upgrade keeps prior data and adds missing columns/index updates.
3. Scan row counts align with git HEAD listing.
4. Project tree includes both file and directory nodes.
5. Config row can round-trip JSON array fields.

## Definition of Done

1. Schema supports scan/tree/config lifecycle.
2. Scanner writes persisted scan intelligence.
3. Storage exposes stable scan/tree/config APIs.

## Files To Touch

1. `src/platform/code_intel/schema.py`
2. `src/platform/code_intel/storage.py`
3. `src/git-analyzer/git_analyzer/scanner.py`
4. `src/git-analyzer/git_analyzer/analysis_config.py`
5. `src/git-analyzer/git_analyzer/presets.py`

