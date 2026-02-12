from __future__ import annotations

import asyncio
import json
import subprocess
from pathlib import Path

from fastapi import BackgroundTasks

from code_intel.app import register_analyzers
from code_intel.routers import analysis as analysis_router
from code_intel.routers import analysis_stream as analysis_stream_router
from code_intel.routers import repos as repos_router
from code_intel.routers import tree as tree_router

register_analyzers()


def _git(repo_path: Path, *args: str) -> None:
    subprocess.run(
        [
            "git",
            "-c",
            "commit.gpgsign=false",
            "-c",
            "tag.gpgsign=false",
            "-c",
            "gpg.format=openpgp",
            "-C",
            str(repo_path),
            *args,
        ],
        check=True,
        capture_output=True,
        text=True,
    )


def _write(path: Path, content: str) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(content, encoding="utf-8")


def _init_test_repo(repo_path: Path) -> None:
    repo_path.mkdir(parents=True, exist_ok=True)
    _git(repo_path, "init")
    _git(repo_path, "config", "user.email", "test@example.com")
    _git(repo_path, "config", "user.name", "Test User")

    _write(repo_path / "src/main.py", "def main():\n    return 1\n")
    _write(repo_path / "src/utils.py", "def util():\n    return 2\n")
    _write(repo_path / "tests/test_main.py", "def test_main():\n    assert True\n")
    _git(repo_path, "add", ".")
    _git(repo_path, "commit", "-m", "initial commit")

    _write(repo_path / "src/main.py", "def main():\n    return 2\n")
    _git(repo_path, "add", "src/main.py")
    _git(repo_path, "commit", "-m", "update main")


def _flatten_tree_status(nodes: list[tree_router.TreeNode]) -> dict[str, str]:
    out: dict[str, str] = {}

    def _walk(node: tree_router.TreeNode) -> None:
        if node.kind == "file":
            out[node.path] = node.status or "excluded"
        for child in node.children:
            _walk(child)

    for root in nodes:
        _walk(root)
    return out


def _create_repo(data_dir: Path, repo_path: Path, name: str = "Flow Repo") -> str:
    response = repos_router.create_repository(
        repos_router.CreateRepoRequest(path=str(repo_path), name=name, data_dir=str(data_dir))
    )
    assert response.scan is not None
    return response.id


def _create_config(repo_id: str, data_dir: Path, name: str) -> str:
    response = analysis_router.create_config(
        repo_id=repo_id,
        request=analysis_router.CreateConfigRequest(
            name=name,
            description="test config",
            preset_id="balanced",
            config={},
            include_patterns=[],
            exclude_patterns=[],
            is_active=True,
        ),
        data_dir=str(data_dir),
    )
    return response.id


async def _collect_stream_events(repo_id: str, run_id: str, data_dir: Path) -> list[dict]:
    response = await analysis_stream_router.stream_run_progress(
        repo_id=repo_id,
        run_id=run_id,
        data_dir=str(data_dir),
    )
    events: list[dict] = []
    async for chunk in response.body_iterator:
        text = chunk.decode("utf-8") if isinstance(chunk, bytes) else str(chunk)
        for line in text.splitlines():
            if not line.startswith("data: "):
                continue
            payload = json.loads(line[6:])
            events.append(payload)
            if payload["state"] in {"completed", "failed", "not_found"}:
                return events
    return events


def test_repo_create_scan_and_tree_preview_flow(tmp_path: Path) -> None:
    data_dir = tmp_path / "data"
    repo_path = tmp_path / "repo"
    _init_test_repo(repo_path)

    repo_id = _create_repo(data_dir, repo_path, name="Tree Repo")

    scan_response = repos_router.get_repository_scan(repo_id=repo_id, data_dir=str(data_dir))
    assert scan_response.state == "ready"
    assert scan_response.scan is not None
    assert scan_response.scan.total_files >= 3
    assert scan_response.scan.total_dirs >= 2

    preview = tree_router.preview_tree(
        repo_id=repo_id,
        request=tree_router.TreePreviewRequest(
            include_patterns=["src/*"],
            exclude_patterns=["tests/*"],
            max_depth=8,
        ),
        data_dir=str(data_dir),
    )
    statuses = _flatten_tree_status(preview)
    assert statuses["src/main.py"] == "included"
    assert statuses["src/utils.py"] == "included"
    assert statuses["tests/test_main.py"] == "excluded"


def test_config_activation_invariant_single_active(tmp_path: Path) -> None:
    data_dir = tmp_path / "data"
    repo_path = tmp_path / "repo"
    _init_test_repo(repo_path)

    repo_id = _create_repo(data_dir, repo_path, name="Config Repo")

    config_a = _create_config(repo_id, data_dir, "Config A")
    config_b = _create_config(repo_id, data_dir, "Config B")

    configs = analysis_router.list_configs(repo_id=repo_id, data_dir=str(data_dir))
    active = [cfg for cfg in configs if cfg.is_active]
    assert len(active) == 1
    assert active[0].id == config_b

    analysis_router.activate_config(repo_id=repo_id, config_id=config_a, data_dir=str(data_dir))
    configs = analysis_router.list_configs(repo_id=repo_id, data_dir=str(data_dir))
    active = [cfg for cfg in configs if cfg.is_active]
    assert len(active) == 1
    assert active[0].id == config_a


def test_run_and_sse_lifecycle_includes_config_id(tmp_path: Path) -> None:
    data_dir = tmp_path / "data"
    repo_path = tmp_path / "repo"
    _init_test_repo(repo_path)

    repo_id = _create_repo(data_dir, repo_path, name="Run Repo")
    config_id = _create_config(repo_id, data_dir, "Run Config")

    background_tasks = BackgroundTasks()
    run_response = analysis_router.run_analysis(
        repo_id=repo_id,
        request=analysis_router.RunRequest(config_id=config_id),
        background_tasks=background_tasks,
        data_dir=str(data_dir),
    )
    run_id = run_response.run_id
    assert run_response.state == "queued"

    # Execute queued background analysis synchronously in test context.
    for task in background_tasks.tasks:
        task.func(*task.args, **task.kwargs)

    events = asyncio.run(_collect_stream_events(repo_id=repo_id, run_id=run_id, data_dir=data_dir))
    assert events, "Expected at least one progress event"
    assert events[-1]["state"] == "completed", events[-1]

    run_record = analysis_router.get_run(repo_id=repo_id, run_id=run_id, data_dir=str(data_dir))
    assert run_record["config_id"] == config_id
    assert run_record["state"] == "completed"
