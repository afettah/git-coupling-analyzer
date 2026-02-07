# Platform Infrastructure Gaps

> **Priority**: High — these affect all analyzers
> **Affects**: All phases

## Summary
Cross-cutting issues in the platform layer that need attention before or alongside analyzer implementation.

## Tasks

### Schema & Storage
- [ ] Add generic `entities` + `relationships` tables alongside current `files` + `edges`
- [ ] Add `analysis_tasks` table for multi-analyzer task tracking
- [ ] Decide on DB filename: `lfca.sqlite` vs `code-intel.sqlite` — standardize
- [ ] Add schema migration support (SCHEMA_VERSION check on open)

### API & Routers
- [ ] Implement `GET /repos/{id}/analyzers/{type}/status` — task status polling endpoint
- [ ] Align run endpoint pattern: `POST /repos/{id}/analyzers/{type}/run` per design
- [ ] Add routers for `deps`, `semantic`, `graph`, `risk`, `intelligence`

### Orchestrator
- [ ] Implement real async task tracking (write task rows to DB with progress)
- [ ] Add `analysis_tasks` DB updates during analysis lifecycle

### Dependencies
- [ ] Add analyzer packages to `platform/pyproject.toml` dependencies
- [ ] Consider a dev setup script for `pip install -e .` in correct order

### Testing
- [ ] Add platform unit tests (currently `tests/test_platform/__init__.py` only)
- [ ] End-to-end test: create repo → run all analyzers → verify DB + API responses
