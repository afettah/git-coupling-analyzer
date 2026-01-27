# Task: Coupling Quality Controls

Status: Proposed

## Problem
Noise from generated files and tiny files reduces signal quality.

## Goal
Add filters and ignore rules for more trustworthy coupling.

## Scope
- Minimum file size/LOC thresholds.
- `.lfcaignore` extending `.gitignore`.
- File type filters (e.g., `*.py`, `*.ts`).

## Relevant files
- `lfca/config.py`
- `frontend/src/components/CreateRepoModal.tsx`

## Design

### 1. Unified Ignore Logic (`IgnoreManager`)

We need a central place to handle file filtering during extraction. This ensures we don't process files that are explicitly ignored by the user or defined as noise.

**Logic:**
1.  Load `.gitignore` from the repository root (if it exists).
2.  Load `.lfcaignore` from the repository root (if it exists).
3.  Merge with user-supplied `ignore_patterns` from config.
4.  Compile patterns (using `pathspec` or `fnmatch`).
5.  Check extension blacklist/whitelist.

**Pseudocode:**

```python
class IgnoreManager:
    def __init__(self, repo_path: Path, config: CouplingConfig):
        self.specs = []
        
        # 1. Load gitignore
        if (repo_path / ".gitignore").exists():
            self.specs.append(parse_gitignore(repo_path / ".gitignore"))
            
        # 2. Load lfcaignore
        if (repo_path / ".lfcaignore").exists():
            self.specs.append(parse_gitignore(repo_path / ".lfcaignore"))
            
        # 3. Config patterns
        if config.ignore_patterns:
            self.specs.append(PathSpec.from_lines('gitwildmatch', config.ignore_patterns))
            
        self.ignored_extensions = set(config.ignored_extensions)

    def is_ignored(self, path: str) -> bool:
        # Extension check
        ext = get_extension(path)
        if ext in self.ignored_extensions:
            return True
            
        # Pattern check
        for spec in self.specs:
            if spec.match_file(path):
                return True
                
        return False
```

### 2. Integration into Extraction (`HistoryExtractor`)

The ignore logic must be applied *during* the commit iteration loop to prevent bloating the database with irrelevant file entries.

**Pseudocode:**

```python
# In lfca/extract.py

def run(self, ...):
    ignore_manager = IgnoreManager(self.paths.repo_root, self.config)
    
    for commit in iter_log(...):
        # ...
        
        for status, path, old_path in changes:
            # 1. Check ignore rules
            if ignore_manager.is_ignored(path):
                continue
                
            # 2. Handle file entries
            file_id = self.storage.get_or_create_file(path)
            # ...
```

### 3. File Size & LOC Filters (`Sync Phase`)

Since extracting file size/LOC for every historical version is expensive, we will apply these filters based on the **HEAD** version of the files during the synchronization phase. Files that are "too small" or "too short" processing-wise will be flagged in the database and excluded from the coupling graph.

**Logic:**
1.  During `sync_head_files` (which already walks the file tree), compute size and simple LOC for each file.
2.  Update the `files` table with `size_bytes` and `loc`.
3.  Add a generic `is_active` or `is_valid` flag to the files table, or filter at query time.

**Pseudocode:**

```python
# In lfca/sync.py

def sync_head_files(paths, storage, config):
    # ... existing sync logic ...
    
    for file_path in all_files_at_head:
        # Get metrics
        size_bytes = file_path.stat().st_size
        loc = count_lines(file_path)
        
        # Determine strict validity (vs just storing stats)
        is_valid = True
        if size_bytes < config.min_file_size:
            is_valid = False
        if loc < config.min_loc:
            is_valid = False
            
        storage.update_file_stats(
            path=str(file_path.relative_to(root)),
            size=size_bytes,
            loc=loc,
            is_valid=is_valid
        )
```

### 4. Graph Construction (`EdgeBuilder`)

When building the coupling graph, we query the `files` table and exclude files that failed the size/LOC checks.

**Pseudocode:**

```python
# In lfca/edges.py

def build(self):
    # Pre-fetch valid file IDs
    valid_file_ids = self.storage.conn.execute("""
        SELECT file_id FROM files 
        WHERE size_bytes >= ? AND loc >= ?
    """, (self.config.min_file_size, self.config.min_loc)).fetchall()
    
    valid_set = set(r[0] for r in valid_file_ids)
    
    # During changeset processing
    for cs in changesets:
        # Filter files in this changeset
        active_files = [f for f in cs.file_ids if f in valid_set]
        
        if len(active_files) < 2:
            continue
            
        # ... proceed with edge counting ...

## UI/UX Design

### 1. "Ignore Preview" in Project Creation
When creating a project, the user should be able to see the impact of their ignore settings immediately.

**Features:**
- **Gitignore Insight**: A small badge/text showing how many files are currently ignored by `.gitignore`.
- **Live Preview Toggle**: An "Advanced Settings" section that expands to show:
    - A searchable list of files with "Included" / "Excluded" status indicators.
    - A text area to add custom glob patterns.
    - Presets for common languages/frameworks.

### 2. General & Language Templates
For all projects, we provide a "General" preset and language-specific optimizations.

**General Presets (Always Available):**
- **Test Files**: `**/tests/**`, `**/test/**`, `**/*_test.go`, `**/*.spec.ts`, `**/*.test.js`, `**/{Tests,Test}/**`.
- **Documentation**: `**/docs/**`, `**/*.md`, `**/LICENSE`.
- **Config/Metadata**: `**/.github/**`, `**/.vscode/**`, `**/.idea/**`.

**C# / .NET Optimized Presets:**
- **Include Patterns:** `**/*.cs`, `**/*.cshtml`, `**/*.xaml`, `**/*.csproj`, `**/*.sln`.
- **Exclude Patterns:** `**/bin/**`, `**/obj/**`, `**/.vs/**`, `**/*.user`, `**/*.suo`, `**/Generated/**`, `**/External/**`.
- **Logic:** These patterns are automatically injected into the `ignore_patterns` if the C# template is selected.

### 3. Advanced Filtering in Clustering
Quality controls aren't just for extraction; they can be applied dynamically during clustering.

**Features:**
- **Dynamic Thresholds**: Sliders for `Min LOC` and `Min File Size` in the clustering configuration modal.
- **Temporary Excludes**: A "Quick Exclude" list that allows users to uncheck specific high-noise files (like `GlobalUsings.cs` or `AssemblyInfo.cs`) without re-running the whole extraction.

## Implementation Details (Refined)

### Language Templates Registry
```python
LANGUAGE_TEMPLATES = {
    "csharp": {
        "name": "C# / .NET",
        "include": ["**/*.cs", "**/*.cshtml", "**/*.xaml", "**/*.csproj", "**/*.sln"],
        "exclude": [
            "**/bin/**", "**/obj/**", "**/.vs/**", 
            "**/*.user", "**/*.suo", "**/Generated/**", 
            "**/TestResults/**", "**/*.g.cs"
        ],
        "min_loc": 10,
        "min_size_bytes": 100
    }
}
```

### New API Endpoints Needed
1.  `GET /repos/{id}/ignore-status`: Returns a summary of ignored vs. included files based on current `.gitignore` and `.lfcaignore`.
2.  `POST /repos/{id}/preview-patterns`: Accepts patterns and returns a list of files that *would* be ignored.
3.  `GET /config/templates`: Returns the list of available language templates.
