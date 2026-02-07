"""Tests for clustering algorithms."""

import pytest
from code_intel.storage import Storage
from git_analyzer.clustering.louvain import Louvain
from git_analyzer.clustering.registry import registry
from git_analyzer.clustering.base import ClusterResult


class TestLouvain:
    """Tests for Louvain clustering algorithm."""

    def test_params_schema(self):
        schema = Louvain.get_params_schema()
        assert schema["type"] == "object"
        assert "resolution" in schema["properties"]
        assert "min_weight" in schema["properties"]
        assert "random_state" in schema["properties"]

    def test_run_basic(self):
        algo = Louvain()
        edges = [
            {"src_file_id": 1, "dst_file_id": 2, "jaccard": 0.8},
            {"src_file_id": 2, "dst_file_id": 3, "jaccard": 0.7},
            {"src_file_id": 1, "dst_file_id": 3, "jaccard": 0.6},
            {"src_file_id": 4, "dst_file_id": 5, "jaccard": 0.9},
            {"src_file_id": 5, "dst_file_id": 6, "jaccard": 0.85},
            {"src_file_id": 4, "dst_file_id": 6, "jaccard": 0.75},
        ]
        file_ids = {1, 2, 3, 4, 5, 6}
        file_paths = {
            1: "src/a.py", 2: "src/b.py", 3: "src/c.py",
            4: "lib/x.py", 5: "lib/y.py", 6: "lib/z.py"
        }

        result = algo.run(edges, file_ids, file_paths, {"random_state": 42})

        assert isinstance(result, ClusterResult)
        assert result.algorithm == "louvain"
        assert result.cluster_count >= 1
        assert len(result.clusters) >= 1
        assert "modularity" in result.metrics

        all_file_ids = []
        for cluster in result.clusters:
            assert "id" in cluster
            assert "size" in cluster
            assert "file_ids" in cluster
            assert "files" in cluster
            all_file_ids.extend(cluster["file_ids"])

        assert set(all_file_ids) == file_ids

    def test_run_with_min_weight(self):
        algo = Louvain()
        edges = [
            {"src_file_id": 1, "dst_file_id": 2, "jaccard": 0.8},
            {"src_file_id": 2, "dst_file_id": 3, "jaccard": 0.3},
        ]
        file_ids = {1, 2, 3}
        file_paths = {1: "a.py", 2: "b.py", 3: "c.py"}

        result = algo.run(edges, file_ids, file_paths, {"min_weight": 0.5, "random_state": 42})

        assert isinstance(result, ClusterResult)
        assert result.cluster_count >= 1

    def test_run_isolated_nodes(self):
        algo = Louvain()
        edges = [{"src_file_id": 1, "dst_file_id": 2, "jaccard": 0.9}]
        file_ids = {1, 2, 3, 4}
        file_paths = {1: "a.py", 2: "b.py", 3: "c.py", 4: "d.py"}

        result = algo.run(edges, file_ids, file_paths, {"random_state": 42})

        assert isinstance(result, ClusterResult)
        all_file_ids = []
        for cluster in result.clusters:
            all_file_ids.extend(cluster["file_ids"])
        assert set(all_file_ids) == file_ids

    def test_run_empty_edges(self):
        algo = Louvain()
        edges = []
        file_ids = {1, 2, 3}
        file_paths = {1: "a.py", 2: "b.py", 3: "c.py"}

        result = algo.run(edges, file_ids, file_paths, {})

        assert isinstance(result, ClusterResult)
        assert result.cluster_count >= 1

    def test_to_dict(self):
        algo = Louvain()
        edges = [{"src_file_id": 1, "dst_file_id": 2, "jaccard": 0.8}]
        file_ids = {1, 2}
        file_paths = {1: "a.py", 2: "b.py"}

        result = algo.run(edges, file_ids, file_paths, {"random_state": 42})
        d = result.to_dict()

        assert d["algorithm"] == "louvain"
        assert "parameters" in d
        assert "cluster_count" in d
        assert "clusters" in d
        assert "metrics" in d
