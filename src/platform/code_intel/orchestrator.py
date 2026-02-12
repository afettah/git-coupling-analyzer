from __future__ import annotations

import uuid
from pathlib import Path
from typing import Any, Dict, List

from code_intel_interfaces.analyzer import AnalysisTask, TaskResult, TaskStatus
from code_intel.registry import registry
from code_intel.logging_utils import get_logger

logger = get_logger(__name__)

class Orchestrator:
    """Manages analysis tasks and dispatches them to analyzers."""

    def run_analysis(
        self,
        analyzer_type: str,
        repo_id: str,
        repo_path: Path,
        db_path: Path,
        parquet_dir: Path,
        config: Dict[str, Any],
        task_id: str | None = None,
        config_id: str | None = None,
    ) -> TaskResult:
        """Dispatch an analysis task to an analyzer."""
        from code_intel.storage import Storage
        from datetime import datetime

        analyzer = registry.get_analyzer(analyzer_type)
        storage = Storage(db_path, parquet_dir)
        
        task_id = task_id or uuid.uuid4().hex[:12]
        task = AnalysisTask(
            task_id=task_id,
            analyzer_type=analyzer_type,
            repo_id=repo_id,
            repo_path=repo_path,
            db_path=db_path,
            parquet_dir=parquet_dir,
            config=config
        )
        
        logger.info(f"Starting analysis task {task_id} for {analyzer_type}")
        
        # 1. Create task entry
        storage.create_task(task, config_id=config_id)
        storage.update_task(task_id, TaskStatus.RUNNING, started_at=datetime.utcnow().isoformat())
        
        try:
            # For now, we run it synchronously. 
            # In the future, this could be dispatched to a background worker.
            result = analyzer.analyze(task)
            
            # 2. Update status on completion
            storage.update_task(
                task_id, 
                result.status,
                entity_count=result.entity_count,
                relationship_count=result.relationship_count,
                metrics_json=result.metrics,
                error=result.error,
                finished_at=datetime.utcnow().isoformat()
            )
            return result
            
        except Exception as e:
            logger.exception(f"Task {task_id} failed")
            error_msg = str(e)
            storage.update_task(
                task_id,
                TaskStatus.FAILED,
                error=error_msg,
                finished_at=datetime.utcnow().isoformat()
            )
            return TaskResult(task_id=task_id, status=TaskStatus.FAILED, error=error_msg)
        finally:
            storage.close()

orchestrator = Orchestrator()
