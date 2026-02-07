"""Clustering algorithms."""

from git_analyzer.clustering.base import ClusterAlgorithm, ClusterResult
from git_analyzer.clustering.registry import get_algorithm, list_algorithms

# Import algorithm modules to trigger registration
from git_analyzer.clustering import components
from git_analyzer.clustering import louvain
from git_analyzer.clustering import label_propagation
from git_analyzer.clustering import hierarchical
from git_analyzer.clustering import dbscan

__all__ = ["ClusterAlgorithm", "ClusterResult", "get_algorithm", "list_algorithms"]
