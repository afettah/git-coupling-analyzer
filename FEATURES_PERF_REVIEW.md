# LFCA Review: Feature Suggestions & Performance Improvements

## Feature Suggestions

1. **Add configurable analysis filters in the CLI and API**
   - The CLI already supports `--since`/`--until` and bulk handling controls in `lfca.cli`, but these knobs are not available via the API.
   - Suggest exposing API endpoints or query params to pass date filters, `max_files_per_commit`, `bulk_policy`, and `topk_edges_per_file` so users can run parameterized analyses programmatically.
   - This would align the API with existing CLI behavior and make repeatable analyses easier to automate.
   - References: `lfca.cli` command flags and extraction/edge configs in `lfca.extract` + `lfca.edges`.

2. **Expose lineage history in the API**
   - The extractor captures file lineage to `file_lineage.parquet`, but the API does not provide an endpoint to query move/rename history.
   - A new endpoint (e.g., `/repos/{repo_id}/files/{path}/lineage`) could return path history to help explain coupling across renames.
   - References: lineage writes in `lfca.extract` and lineage data in `lfca.indexes`.

3. **Add a “top impacted folders” endpoint**
   - The existing API focuses on file-level coupling; add a view that aggregates edges to folder-level impact for quick architectural insights.
   - This could reuse the `edges_folder.parquet` artifact (if generated) or aggregate on-the-fly by path prefix.
   - Reference: current file-focused impact endpoints in `lfca.api`.

4. **Add optional merge-commit handling controls**
   - Commits are flagged as merge commits during extraction, but this flag isn’t currently used in analysis.
   - Consider adding a filter to exclude or downweight merge commits, or a CLI option to toggle whether merge commits contribute to edges.
   - Reference: merge detection in `lfca.extract` + header capture in `lfca.git`.

## Performance Improvements

1. **Stream edges to reduce peak memory usage**
   - `EdgeBuilder.build` accumulates all pair counts in memory, which can be large for big repos.
   - Consider chunked aggregation: store pair counts in a temporary on-disk store (SQLite or Parquet), or add a spilling mechanism when the in-memory map grows past a threshold.
   - Reference: `lfca.edges.EdgeBuilder.build`.

2. **Use Parquet predicate pushdown for impact queries**
   - The API scans every batch in `edges_file_topk.parquet` and filters in Python.
   - Switching to column projection + predicate pushdown (or creating a Parquet partition keyed by `src_file_id`) would reduce IO for large datasets.
   - Reference: `_edges_for_file` in `lfca.api`.

3. **Batch writes for file stats and lineage**
   - `_write_file_stats` and `_write_lineage` currently load all rows into memory before writing.
   - Writing in smaller batches (or using a generator to `ParquetSink.write_rows`) could reduce memory for large repos.
   - Reference: `_write_file_stats` and `_write_lineage` in `lfca.extract`.

4. **Reduce SQLite round trips during extraction**
   - `HistoryExtractor.run` calls `FileIndex` methods repeatedly per change; this can be optimized by batching operations or caching lookup results per commit.
   - Using a transaction per commit (or enabling WAL mode) may reduce SQLite overhead in high-change repos.
   - Reference: `lfca.extract.HistoryExtractor.run` and `lfca.indexes.FileIndex`.

5. **Parallelize heavy post-processing**
   - Edge building and file stats/lineage writing are CPU-heavy but currently sequential.
   - For large datasets, a parallel build step (e.g., shard by file_id range) could improve throughput.
   - Reference: `lfca.edges.EdgeBuilder.build` and the post-processing steps in `lfca.extract`.
