from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path
from typing import Iterable, Mapping

import pyarrow as pa
import pyarrow.parquet as pq


@dataclass
class ParquetSink:
    path: Path
    schema: "pa.schema"

    def __post_init__(self) -> None:
        self._writer = pq.ParquetWriter(self.path, self.schema, compression="zstd")

    def write_rows(self, rows: Iterable[Mapping[str, object]]) -> None:
        rows = list(rows)
        if not rows:
            return
        batch = pa.Table.from_pylist(rows, schema=self.schema)
        self._writer.write_table(batch)

    def close(self) -> None:
        self._writer.close()
