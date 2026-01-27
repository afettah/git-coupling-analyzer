from __future__ import annotations

import sqlite3
from dataclasses import dataclass
from pathlib import Path
from typing import Iterable, Optional


@dataclass
class FileIndex:
    db_path: Path

    def __post_init__(self) -> None:
        self._conn = sqlite3.connect(self.db_path)
        self._conn.execute(
            """
            CREATE TABLE IF NOT EXISTS file_index (
                file_id INTEGER PRIMARY KEY,
                path_current TEXT UNIQUE NOT NULL
            )
            """
        )
        self._conn.execute(
            """
            CREATE TABLE IF NOT EXISTS lineage (
                file_id INTEGER NOT NULL,
                path TEXT NOT NULL,
                start_commit TEXT NOT NULL,
                end_commit TEXT,
                PRIMARY KEY (file_id, path, start_commit)
            )
            """
        )
        self._conn.commit()

    def close(self) -> None:
        self._conn.commit()
        self._conn.close()

    def next_file_id(self) -> int:
        row = self._conn.execute("SELECT COALESCE(MAX(file_id), 0) + 1 FROM file_index").fetchone()
        return int(row[0])

    def get_file_id(self, path: str) -> Optional[int]:
        row = self._conn.execute(
            "SELECT file_id FROM file_index WHERE path_current = ?", (path,)
        ).fetchone()
        return int(row[0]) if row else None

    def set_file_id(self, file_id: int, path: str) -> None:
        self._conn.execute(
            "INSERT OR REPLACE INTO file_index (file_id, path_current) VALUES (?, ?)",
            (file_id, path),
        )

    def update_path(self, file_id: int, new_path: str) -> None:
        self._conn.execute(
            "UPDATE file_index SET path_current = ? WHERE file_id = ?",
            (new_path, file_id),
        )

    def add_lineage(self, file_id: int, path: str, start_commit: str, end_commit: str | None) -> None:
        self._conn.execute(
            """
            INSERT OR REPLACE INTO lineage (file_id, path, start_commit, end_commit)
            VALUES (?, ?, ?, ?)
            """,
            (file_id, path, start_commit, end_commit),
        )

    def iter_lineage(self) -> Iterable[tuple[int, str, str, Optional[str]]]:
        cursor = self._conn.execute(
            "SELECT file_id, path, start_commit, end_commit FROM lineage"
        )
        yield from cursor.fetchall()
