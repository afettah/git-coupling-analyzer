# Task 04 - Analysis Engine Refactor + Critical Fixes

## Objective

Make runtime behavior fully config-driven and close critical correctness gaps in extraction/edges/API.

## Dependencies

1. Task 01.
2. Task 03.

## Detailed Implementation

## 1) Runtime config migration

1. Introduce `AnalysisConfig` in `analysis_config.py`.
2. Add adapter from old `CouplingConfig` for migration period.
3. Update plugin/runner to consume resolved runtime config.

## 2) `git.py` command builder

Add options:

1. dynamic `--find-renames=<threshold>%`
2. `--numstat` when enabled
3. `--no-merges` and/or `--first-parent`
4. `--diff-filter=<...>`
5. keep `since/until/ref/all_refs`

Pseudocode:

```python
args = build_git_log_args(repo_path, cfg)
proc = subprocess.Popen(args, ...)
```

## 3) `extract.py` fixes

1. remove early skip on `max_changeset_size`.
2. parse numstat and persist `lines_added`/`lines_deleted` in `changes.parquet`.
3. add entity cache to reduce repeated SQL lookups.
4. unify path/extension/include/exclude decisions.
5. keep commit-level filters coherent with changeset mode.

Numstat parsing sketch:

```python
# numstat lines format: "<added>\t<deleted>\t<path>"
if cfg.include_numstat:
    added, deleted, path = parse_numstat_row(token)
    change.lines_added = to_int_or_zero(added)
    change.lines_deleted = to_int_or_zero(deleted)
```

## 4) `changesets.py` fixes

1. single authoritative size filter stage.
2. enforce:
- `max_changeset_size` for commit mode
- `max_logical_changeset_size` for grouped modes
3. preserve mode-specific constraints.

## 5) `edges.py` fixes

1. enforce `min_revisions` before edge finalization.
2. maintain separate raw/weighted pair counters.
3. implement decay by commit/changeset age.
4. enforce `min_component_cooccurrence` in component aggregation.
5. remove dead penalty branch that cannot trigger after filtering.

Formula contract:

```python
jaccard = pair_raw / (src_count + dst_count - pair_raw)
jaccard_weighted = pair_weighted / (src_weight + dst_weight - pair_weighted)
```

## 6) API correctness fix

In `git_analyzer/api.py`:

1. make `get_file_coupling` symmetric (src + dst directions).
2. align risk score formula usage across details/hotspots endpoints.

## Verification Matrix

1. Fixture run with defaults remains stable.
2. merge-heavy fixture reflects merge strategy changes.
3. rename threshold changes alter detected rename behavior.
4. numstat-enabled run produces non-zero churn values where expected.
5. symmetric coupling query returns expected neighbors.

## Definition of Done

1. Engine honors exposed parameters.
2. Critical correctness issues are closed.

## Files To Touch

1. `src/git-analyzer/git_analyzer/analysis_config.py`
2. `src/git-analyzer/git_analyzer/config.py`
3. `src/git-analyzer/git_analyzer/git.py`
4. `src/git-analyzer/git_analyzer/extract.py`
5. `src/git-analyzer/git_analyzer/changesets.py`
6. `src/git-analyzer/git_analyzer/edges.py`
7. `src/git-analyzer/git_analyzer/api.py`
8. `src/git-analyzer/git_analyzer/plugin.py`
9. `src/git-analyzer/git_analyzer/runner.py`

