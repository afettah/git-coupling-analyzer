from __future__ import annotations

import uuid
from pathlib import Path
from typing import Literal

from fastapi import APIRouter, BackgroundTasks, HTTPException, Query
from pydantic import BaseModel, Field

from code_intel.config import RepoPaths, DEFAULT_DATA_DIR
from code_intel.logging_utils import get_logger
from code_intel.orchestrator import orchestrator
from code_intel.registry import registry
from code_intel.storage import Storage
from git_analyzer.analysis_config import normalize_config_dict
from git_analyzer.presets import get_preset, list_presets, suggest_preset

# TODO (ISSUE 009): Add date range validation against scan boundaries
router = APIRouter(prefix="/repos/{repo_id}", tags=["analysis"])
logger = get_logger(__name__)


def _storage(repo_id: str, data_dir: str = Query(default=None)) -> Storage:
    if data_dir is None:
        data_dir = str(DEFAULT_DATA_DIR)
    paths = RepoPaths(Path(data_dir), repo_id)
    return Storage(paths.db_path, paths.parquet_dir)


def _paths(repo_id: str, data_dir: str = Query(default=None)) -> RepoPaths:
    if data_dir is None:
        data_dir = str(DEFAULT_DATA_DIR)
    return RepoPaths(Path(data_dir), repo_id)


class ConfigRecord(BaseModel):
    id: str
    repo_id: str
    is_active: bool
    preset_id: str | None = None
    name: str
    description: str = ""
    config: dict
    include_patterns: list[str]
    exclude_patterns: list[str]
    created_at: str | None = None
    updated_at: str | None = None


class ConfigIssue(BaseModel):
    field: str
    message: str
    severity: Literal["error", "warning"]


class ValidationResult(BaseModel):
    errors: list[str]
    warnings: list[str]
    field_errors: dict[str, list[str]]
    field_warnings: dict[str, list[str]]


class CreateConfigRequest(BaseModel):
    name: str = "Configuration"
    description: str = ""
    preset_id: str | None = None
    config: dict = Field(default_factory=dict)
    include_patterns: list[str] = Field(default_factory=list)
    exclude_patterns: list[str] = Field(default_factory=list)
    is_active: bool = True


class UpdateConfigRequest(BaseModel):
    name: str | None = None
    description: str | None = None
    preset_id: str | None = None
    config: dict | None = None
    include_patterns: list[str] | None = None
    exclude_patterns: list[str] | None = None
    is_active: bool | None = None


class RunRequest(BaseModel):
    config_id: str | None = None


class RunResponse(BaseModel):
    run_id: str
    state: str


class PresetOption(BaseModel):
    id: str
    label: str
    description: str
    impact: str
    config: dict
    recommendation_reason: str | None = None


def _to_config_record(row: dict) -> ConfigRecord:
    return ConfigRecord(
        id=row["config_id"],
        repo_id=row["repo_id"],
        is_active=bool(row.get("is_active", False)),
        preset_id=row.get("preset_id"),
        name=row.get("name", "Configuration"),
        description=row.get("description", ""),
        config=row.get("config", {}),
        include_patterns=row.get("include_patterns", []),
        exclude_patterns=row.get("exclude_patterns", []),
        created_at=row.get("created_at"),
        updated_at=row.get("updated_at"),
    )


def _validate_config(config: dict) -> ValidationResult:
    analyzer = registry.get_analyzer("git")
    normalized = normalize_config_dict(config)
    errors = analyzer.validate_config(normalized)

    warnings: list[str] = []
    if normalized.get("decay_half_life_days") is not None and int(normalized["decay_half_life_days"]) < 7:
        warnings.append("Decay half-life below 7 days may over-weight recency.")
    if normalized.get("all_refs") and normalized.get("ref") not in (None, "", "HEAD"):
        warnings.append("ref is ignored when all_refs is enabled.")
    if normalized.get("window_days") and normalized.get("since"):
        warnings.append("window_days is ignored when since is set.")

    field_errors: dict[str, list[str]] = {}
    field_warnings: dict[str, list[str]] = {}

    for msg in errors:
        field = msg.split(" ", 1)[0] if " " in msg else "config"
        field_errors.setdefault(field, []).append(msg)

    for msg in warnings:
        if "decay" in msg.lower():
            field = "decay_half_life_days"
        elif "all_refs" in msg:
            field = "all_refs"
        elif "window_days" in msg:
            field = "window_days"
        else:
            field = "config"
        field_warnings.setdefault(field, []).append(msg)

    return ValidationResult(
        errors=errors,
        warnings=warnings,
        field_errors=field_errors,
        field_warnings=field_warnings,
    )


@router.post("/analysis/configs", response_model=ConfigRecord)
def create_config(repo_id: str, request: CreateConfigRequest, data_dir: str = Query(default=None)) -> ConfigRecord:
    if data_dir is None:
        data_dir = str(DEFAULT_DATA_DIR)
    storage = _storage(repo_id, data_dir)
    try:
        normalized = normalize_config_dict(request.config)
        config_id = uuid.uuid4().hex
        storage.create_analysis_config(
            {
                "config_id": config_id,
                "repo_id": repo_id,
                "name": request.name,
                "description": request.description,
                "analyzer_type": "git",
                "preset_id": request.preset_id,
                "config": normalized,
                "include_patterns": request.include_patterns,
                "exclude_patterns": request.exclude_patterns,
                "is_active": request.is_active,
            }
        )
        saved = storage.get_analysis_config(config_id=config_id, repo_id=repo_id)
        if not saved:
            raise HTTPException(status_code=500, detail="Failed to persist configuration")
        return _to_config_record(saved)
    finally:
        storage.close()


@router.get("/analysis/configs", response_model=list[ConfigRecord])
def list_configs(repo_id: str, data_dir: str = Query(default=None)) -> list[ConfigRecord]:
    if data_dir is None:
        data_dir = str(DEFAULT_DATA_DIR)
    storage = _storage(repo_id, data_dir)
    try:
        rows = storage.list_analysis_configs(repo_id=repo_id, analyzer_type="git", limit=500)
        return [_to_config_record(row) for row in rows]
    finally:
        storage.close()


@router.get("/analysis/configs/{config_id}", response_model=ConfigRecord)
def get_config(repo_id: str, config_id: str, data_dir: str = Query(default=None)) -> ConfigRecord:
    if data_dir is None:
        data_dir = str(DEFAULT_DATA_DIR)
    storage = _storage(repo_id, data_dir)
    try:
        row = storage.get_analysis_config(config_id=config_id, repo_id=repo_id)
        if not row:
            raise HTTPException(status_code=404, detail="Config not found")
        return _to_config_record(row)
    finally:
        storage.close()


@router.put("/analysis/configs/{config_id}", response_model=ConfigRecord)
def update_config(repo_id: str, config_id: str, request: UpdateConfigRequest, data_dir: str = Query(default=None)) -> ConfigRecord:
    if data_dir is None:
        data_dir = str(DEFAULT_DATA_DIR)
    storage = _storage(repo_id, data_dir)
    try:
        patch = request.model_dump(exclude_none=True)
        if "config" in patch:
            patch["config"] = normalize_config_dict(patch["config"])
        updated = storage.update_analysis_config(repo_id=repo_id, config_id=config_id, patch=patch)
        if not updated:
            raise HTTPException(status_code=404, detail="Config not found")
        return _to_config_record(updated)
    finally:
        storage.close()


@router.delete("/analysis/configs/{config_id}")
def delete_config(repo_id: str, config_id: str, data_dir: str = Query(default=None)) -> dict:
    if data_dir is None:
        data_dir = str(DEFAULT_DATA_DIR)
    storage = _storage(repo_id, data_dir)
    try:
        deleted = storage.delete_analysis_config(repo_id=repo_id, config_id=config_id)
        if not deleted:
            raise HTTPException(status_code=404, detail="Config not found")
        return {"status": "deleted"}
    finally:
        storage.close()


@router.post("/analysis/configs/{config_id}/activate")
def activate_config(repo_id: str, config_id: str, data_dir: str = Query(default=None)) -> dict:
    if data_dir is None:
        data_dir = str(DEFAULT_DATA_DIR)
    storage = _storage(repo_id, data_dir)
    try:
        row = storage.get_analysis_config(config_id=config_id, repo_id=repo_id)
        if not row:
            raise HTTPException(status_code=404, detail="Config not found")
        storage.set_active_config(repo_id=repo_id, config_id=config_id)
        return {"status": "ok"}
    finally:
        storage.close()


@router.post("/analysis/configs/validate", response_model=ValidationResult)
def validate_config(repo_id: str, request: CreateConfigRequest, data_dir: str = Query(default=None)) -> ValidationResult:
    if data_dir is None:
        data_dir = str(DEFAULT_DATA_DIR)
    _ = repo_id
    _ = data_dir
    normalized = normalize_config_dict(request.config)
    return _validate_config(normalized)


@router.get("/presets", response_model=list[PresetOption])
def get_presets(repo_id: str, data_dir: str = Query(default=None)) -> list[PresetOption]:
    if data_dir is None:
        data_dir = str(DEFAULT_DATA_DIR)
    storage = _storage(repo_id, data_dir)
    try:
        scan = storage.get_latest_project_scan(repo_id=repo_id)
        recommended_id, reason = suggest_preset(scan)
        response: list[PresetOption] = []
        for preset in list_presets():
            response.append(
                PresetOption(
                    id=preset["id"],
                    label=preset["label"],
                    description=preset["description"],
                    impact=preset["impact"],
                    config=preset.get("config", {}),
                    recommendation_reason=reason if preset["id"] == recommended_id else None,
                )
            )
        return response
    finally:
        storage.close()


@router.get("/presets/{preset_id}", response_model=PresetOption)
def get_preset_by_id(repo_id: str, preset_id: str, data_dir: str = Query(default=None)) -> PresetOption:
    if data_dir is None:
        data_dir = str(DEFAULT_DATA_DIR)
    storage = _storage(repo_id, data_dir)
    try:
        preset = get_preset(preset_id)
        if not preset:
            raise HTTPException(status_code=404, detail="Preset not found")
        scan = storage.get_latest_project_scan(repo_id=repo_id)
        recommended_id, reason = suggest_preset(scan)
        return PresetOption(
            id=preset["id"],
            label=preset["label"],
            description=preset["description"],
            impact=preset["impact"],
            config=preset.get("config", {}),
            recommendation_reason=reason if recommended_id == preset_id else None,
        )
    finally:
        storage.close()


@router.post("/analysis/run", response_model=RunResponse)
def run_analysis(
    repo_id: str,
    request: RunRequest,
    background_tasks: BackgroundTasks,
    data_dir: str = Query(default=None),
) -> RunResponse:
    if data_dir is None:
        data_dir = str(DEFAULT_DATA_DIR)
    storage = _storage(repo_id, data_dir)
    paths = _paths(repo_id, data_dir)
    try:
        config_record = None
        if request.config_id:
            config_record = storage.get_analysis_config(config_id=request.config_id, repo_id=repo_id)
        if config_record is None:
            config_record = storage.get_active_config(repo_id=repo_id)
        if config_record is None:
            raise HTTPException(status_code=400, detail="No active configuration found")

        validation = _validate_config(config_record["config"])
        if validation.errors:
            raise HTTPException(status_code=422, detail=validation.model_dump())

        source_row = storage.conn.execute(
            "SELECT value FROM repo_meta WHERE key = 'source_path'"
        ).fetchone()
        if not source_row or not source_row[0]:
            raise HTTPException(status_code=404, detail="Repo source path not found")
        repo_path = Path(str(source_row[0]))

        run_id = uuid.uuid4().hex
        config_payload = dict(config_record["config"])
        config_payload["include_paths"] = config_record.get("include_patterns", [])
        config_payload["exclude_paths"] = config_record.get("exclude_patterns", [])

        def _run_job():
            orchestrator.run_analysis(
                analyzer_type="git",
                repo_id=repo_id,
                repo_path=repo_path,
                db_path=paths.db_path,
                parquet_dir=paths.parquet_dir,
                config=config_payload,
                task_id=run_id,
                config_id=config_record["config_id"],
            )

        background_tasks.add_task(_run_job)
        return RunResponse(run_id=run_id, state="queued")
    finally:
        storage.close()


@router.get("/analysis/runs")
def list_runs(repo_id: str, data_dir: str = Query(default=None)) -> list[dict]:
    if data_dir is None:
        data_dir = str(DEFAULT_DATA_DIR)
    storage = _storage(repo_id, data_dir)
    try:
        return storage.list_tasks(analyzer_type="git", limit=200)
    except Exception as exc:
        logger.warning("Failed to list analysis runs for repo %s: %s", repo_id, exc)
        return []
    finally:
        storage.close()


@router.get("/analysis/runs/{run_id}")
def get_run(repo_id: str, run_id: str, data_dir: str = Query(default=None)) -> dict:
    if data_dir is None:
        data_dir = str(DEFAULT_DATA_DIR)
    storage = _storage(repo_id, data_dir)
    try:
        run = storage.get_task(run_id)
        if not run:
            raise HTTPException(status_code=404, detail="Run not found")
        return run
    finally:
        storage.close()
