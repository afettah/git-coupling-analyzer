"""
Code Intelligence Interfaces — shared contracts for all analyzers.

This package defines the abstract interfaces that analyzers implement
and the shared types used across the platform. It has ZERO dependencies
on any analyzer or platform internals, making it the leaf of the
dependency graph that breaks circular imports.

Packages that depend on this:
  - code-intel-platform (orchestrator)
  - git-analyzer
  - dep-analyzer
  - semantic-analyzer
  - project-intelligence
"""
__version__ = "0.1.0"

# Re-export everything for convenient single-import access
from code_intel_interfaces.analyzer import (
    AnalyzerType,
    TaskStatus,
    AnalysisTask,
    TaskResult,
    BaseAnalyzer,
)
from code_intel_interfaces.types import (
    Entity,
    Relationship,
    Domain,
    RelKind,
    EntityKind,
)
from code_intel_interfaces.git_analyzer import GitAnalyzerAPI
from code_intel_interfaces.dep_analyzer import DepAnalyzerAPI
from code_intel_interfaces.semantic_analyzer import SemanticAnalyzerAPI
from code_intel_interfaces.intelligence import IntelligenceAPI

__all__ = [
    # Analyzer base
    "AnalyzerType",
    "TaskStatus",
    "AnalysisTask",
    "TaskResult",
    "BaseAnalyzer",
    # Shared types
    "Entity",
    "Relationship",
    "Domain",
    "RelKind",
    "EntityKind",
    # Analyzer-specific APIs
    "GitAnalyzerAPI",
    "DepAnalyzerAPI",
    "SemanticAnalyzerAPI",
    "IntelligenceAPI",
]
