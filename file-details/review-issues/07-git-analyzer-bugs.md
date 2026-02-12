# Issue 07: Git Analyzer — Import Errors, Config Mismatch, Fragile Paths

## Severity: HIGH

## Problem
Several correctness issues in the git-analyzer module:
1. `analysis_config.py` imports `from code_intel.config` which may not resolve correctly depending on Python path
2. `cli.py` uses `CouplingConfig` but should align with `GitAnalysisConfig`
3. `plugin.py` reconstructs `RepoPaths` by assuming db_path directory structure — fragile
4. `mirror.py` uses `subprocess` with `check=True` but doesn't catch `CalledProcessError`
5. `runner.py` assumes task status is already RUNNING without validation

## Expected Behavior
- All imports resolve correctly in the installed package
- Config classes are consistent across CLI and plugin entry points
- Path construction uses explicit parameters, not assumptions about parent directory structure
- Subprocess failures are caught and wrapped in meaningful errors
- Task state transitions are validated

## Value
Prevents runtime crashes during analysis, ensures reliable plugin operation, and makes the git analyzer robust for production use.

## Concerned Files

| File | Issue |
|------|-------|
| `src/git-analyzer/git_analyzer/analysis_config.py` | `from code_intel.config import ValidationMode` — import may fail |
| `src/git-analyzer/git_analyzer/cli.py` | Uses `CouplingConfig` — inconsistent with `GitAnalysisConfig` |
| `src/git-analyzer/git_analyzer/plugin.py` | Reconstructs `RepoPaths` from `db_path.parent` — fragile assumption |
| `src/git-analyzer/git_analyzer/mirror.py` | `subprocess.run(check=True)` without try/except for CalledProcessError |
| `src/git-analyzer/git_analyzer/runner.py` | No validation that task status is RUNNING before proceeding |
| `src/git-analyzer/git_analyzer/config.py` | No range validation for `decay_half_life_days`, `window_days`, `min_revisions`, `min_cooccurrence` |

## Suggested Changes

### 1. Fix import to use relative or conditional import
```python
# analysis_config.py
try:
    from code_intel.config import ValidationMode
except ImportError:
    from ..platform.code_intel.config import ValidationMode
```
Or define `ValidationMode` in the interfaces package.

### 2. Unify config classes
Either use `GitAnalysisConfig` everywhere or make `CouplingConfig` a subset/alias.

### 3. Pass RepoPaths explicitly to plugin.analyze()
```python
# Instead of reconstructing from db_path
def analyze(self, task: AnalysisTask) -> TaskResult:
    paths = task.repo_paths  # Pass explicitly via AnalysisTask
```

### 4. Wrap subprocess calls
```python
try:
    subprocess.run(cmd, check=True, capture_output=True, text=True)
except subprocess.CalledProcessError as e:
    raise GitMirrorError(f"Git mirror failed: {e.stderr}") from e
```

### 5. Add config validation
```python
@field_validator('decay_half_life_days')
def validate_positive(cls, v):
    if v <= 0:
        raise ValueError("Must be positive")
    return v
```
