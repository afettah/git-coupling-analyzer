# Task 03 - Analysis Config CRUD + Run API

## Objective

Replace ad-hoc run payload flow with persisted, validated, reusable configs and run-by-config execution.

## Dependencies

1. Task 01.
2. Task 02 (recommended for preview coupling).

## Detailed Implementation

## 1) New router `src/platform/code_intel/routers/analysis.py`

### Endpoints

1. `POST /repos/{repo_id}/analysis/configs`
2. `GET /repos/{repo_id}/analysis/configs`
3. `GET /repos/{repo_id}/analysis/configs/{config_id}`
4. `PUT /repos/{repo_id}/analysis/configs/{config_id}`
5. `DELETE /repos/{repo_id}/analysis/configs/{config_id}`
6. `POST /repos/{repo_id}/analysis/run`
7. `GET /repos/{repo_id}/analysis/runs`
8. `GET /repos/{repo_id}/analysis/runs/{run_id}`
9. `GET /repos/{repo_id}/presets`
10. `GET /repos/{repo_id}/presets/{name}`

## 2) Validation contract

Issue schema:

```python
class ConfigIssue(BaseModel):
    field: str
    message: str
    severity: Literal["error", "warning"]
```

Validation rules:

1. `by_ticket_id` requires `ticket_id_pattern`.
2. `since <= until` when both provided.
3. numeric thresholds must be positive and coherent.
4. incompatible options produce explicit errors.

## 3) Run behavior

Run request:

```json
{ "config_id": "cfg_123" }
```

Run pipeline pseudocode:

```python
cfg = storage.get_analysis_config(config_id)
issues = validate_config(cfg)
if any(i.severity == "error" for i in issues):
    raise HTTPException(422, detail=issues)

run_id = create_run_task(config_id)
orchestrator.run_analysis(..., config=cfg, task_id=run_id)
return {"run_id": run_id, "state": "queued"}
```

## 4) Legacy compatibility bridge

Keep `routers/analyzers.py` temporarily:

1. map incoming `config` to ephemeral saved config row.
2. call new run service internally.
3. return legacy-shaped response until frontend cutover.

## 5) Frontend API

Create `src/frontend/src/api/analysis.ts`:

1. typed config models.
2. CRUD methods.
3. run/status methods.
4. presets methods.

## Verification Matrix

1. CRUD round-trip preserves all fields.
2. validation errors block run.
3. warnings do not block run.
4. task row includes `config_id`.
5. legacy endpoint still functions during migration.

## Definition of Done

1. Config lifecycle APIs are production-ready.
2. Run API is config-based and reproducible.

## Files To Touch

1. `src/platform/code_intel/routers/analysis.py`
2. `src/platform/code_intel/storage.py`
3. `src/platform/code_intel/app.py`
4. `src/platform/code_intel/routers/analyzers.py`
5. `src/git-analyzer/git_analyzer/analysis_config.py`
6. `src/git-analyzer/git_analyzer/presets.py`
7. `src/frontend/src/api/analysis.ts`

