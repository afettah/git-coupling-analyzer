from __future__ import annotations
from dataclasses import dataclass, field
from typing import Any


@dataclass
class Entity:
    """A code entity (file, class, function, package)."""
    entity_id: int | None = None
    file_id: int | None = None
    kind: str = "file"              # file, class, function, module, package
    name: str = ""
    qualified_name: str | None = None
    language: str | None = None
    line_start: int | None = None
    line_end: int | None = None
    metadata: dict[str, Any] = field(default_factory=dict)


@dataclass
class Relationship:
    """A relationship between two entities."""
    rel_id: int | None = None
    source_type: str = ""           # git, deps, semantic, intelligence
    rel_kind: str = ""              # CO_CHANGED, IMPORTS, SIMILAR_TO, etc.
    src_entity_id: int = 0
    dst_entity_id: int = 0
    weight: float = 1.0
    properties: dict[str, Any] = field(default_factory=dict)
    run_id: str | None = None


@dataclass
class Domain:
    """A semantic domain (cluster of related entities)."""
    domain_id: int | None = None
    label: str = ""
    description: str | None = None
    entity_count: int = 0
    coherence_score: float = 0.0
    top_terms: list[str] = field(default_factory=list)


# Relationship kinds — constants
class RelKind:
    # Git analyzer
    CO_CHANGED = "CO_CHANGED"

    # Dependency analyzer
    IMPORTS = "IMPORTS"
    DEPENDS_ON = "DEPENDS_ON"       # external package dependency

    # Semantic analyzer
    SIMILAR_TO = "SIMILAR_TO"
    BELONGS_TO_DOMAIN = "BELONGS_TO_DOMAIN"

    # Future
    CALLS = "CALLS"
    EXTENDS = "EXTENDS"
    IMPLEMENTS = "IMPLEMENTS"
    TESTED_BY = "TESTED_BY"
    OWNS = "OWNS"


# Entity kinds — constants
class EntityKind:
    FILE = "file"
    CLASS = "class"
    FUNCTION = "function"
    MODULE = "module"
    PACKAGE = "package"
    EXTERNAL_PACKAGE = "external_package"
