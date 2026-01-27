"""Clustering algorithms."""

from lfca.clustering.base import ClusterAlgorithm, ClusterResult
from lfca.clustering.registry import get_algorithm, list_algorithms

# Import algorithm modules to trigger registration
from lfca.clustering import components
from lfca.clustering import louvain
from lfca.clustering import label_propagation
from lfca.clustering import hierarchical
from lfca.clustering import dbscan

__all__ = ["ClusterAlgorithm", "ClusterResult", "get_algorithm", "list_algorithms"]
