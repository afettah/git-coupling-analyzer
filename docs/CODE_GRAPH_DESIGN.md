# Code Graph - Unified Codebase Knowledge Graph

> A scalable graph-based system to store, query, and analyze code relationships from multiple sources

---

## 🎯 Vision

Code Graph is a unified knowledge graph that aggregates code intelligence from multiple sources (static analysis, git history, runtime metrics, etc.) to provide rich, queryable insights about any code entity (class, method, file, module).

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           CODE GRAPH PLATFORM                                │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│   ┌───────────┐  ┌───────────┐  ┌───────────┐  ┌───────────┐               │
│   │  Static   │  │    Git    │  │  Runtime  │  │  External │               │
│   │ Analysis  │  │  History  │  │  Metrics  │  │   APIs    │               │
│   └─────┬─────┘  └─────┬─────┘  └─────┬─────┘  └─────┬─────┘               │
│         │              │              │              │                      │
│         └──────────────┴──────────────┴──────────────┘                      │
│                               │                                             │
│                    ┌──────────▼──────────┐                                  │
│                    │   INGESTION LAYER   │                                  │
│                    │   (Adapters/ETL)    │                                  │
│                    └──────────┬──────────┘                                  │
│                               │                                             │
│                    ┌──────────▼──────────┐                                  │
│                    │   GRAPH DATABASE    │                                  │
│                    │   (Neo4j/DGraph)    │                                  │
│                    └──────────┬──────────┘                                  │
│                               │                                             │
│                    ┌──────────▼──────────┐                                  │
│                    │     QUERY API       │                                  │
│                    │   (GraphQL/REST)    │                                  │
│                    └──────────┬──────────┘                                  │
│                               │                                             │
│         ┌─────────────────────┼─────────────────────┐                       │
│         ▼                     ▼                     ▼                       │
│   ┌───────────┐        ┌───────────┐        ┌───────────┐                   │
│   │    CLI    │        │  Web UI   │        │   IDE     │                   │
│   │  Client   │        │ Dashboard │        │ Extension │                   │
│   └───────────┘        └───────────┘        └───────────┘                   │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 📊 Graph Data Model

### Core Entities (Nodes)

```
┌─────────────────────────────────────────────────────────────────────────┐
│                           NODE TYPES                                     │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│  ┌─────────────┐   ┌─────────────┐   ┌─────────────┐   ┌─────────────┐ │
│  │   :Module   │   │   :File     │   │   :Class    │   │  :Method    │ │
│  ├─────────────┤   ├─────────────┤   ├─────────────┤   ├─────────────┤ │
│  │ name        │   │ path        │   │ name        │   │ name        │ │
│  │ version     │   │ language    │   │ visibility  │   │ signature   │ │
│  │ type        │   │ loc         │   │ abstract    │   │ visibility  │ │
│  │ repo_url    │   │ complexity  │   │ final       │   │ static      │ │
│  └─────────────┘   └─────────────┘   └─────────────┘   └─────────────┘ │
│                                                                         │
│  ┌─────────────┐   ┌─────────────┐   ┌─────────────┐   ┌─────────────┐ │
│  │  :Commit    │   │  :Author    │   │  :Package   │   │ :Interface  │ │
│  ├─────────────┤   ├─────────────┤   ├─────────────┤   ├─────────────┤ │
│  │ sha         │   │ email       │   │ name        │   │ name        │ │
│  │ message     │   │ name        │   │ version     │   │ methods     │ │
│  │ timestamp   │   │ team        │   │ manager     │   │ visibility  │ │
│  │ stats       │   │ org         │   │ source      │   │             │ │
│  └─────────────┘   └─────────────┘   └─────────────┘   └─────────────┘ │
│                                                                         │
│  ┌─────────────┐   ┌─────────────┐   ┌─────────────┐                    │
│  │ :Function   │   │ :Variable   │   │   :Test     │                    │
│  ├─────────────┤   ├─────────────┤   ├─────────────┤                    │
│  │ name        │   │ name        │   │ name        │                    │
│  │ params      │   │ type        │   │ type        │                    │
│  │ return_type │   │ scope       │   │ covers      │                    │
│  │ async       │   │ mutable     │   │ status      │                    │
│  └─────────────┘   └─────────────┘   └─────────────┘                    │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

### Relationships (Edges)

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           RELATIONSHIP TYPES                                 │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  ╔═══════════════════════════════════════════════════════════════════════╗ │
│  ║  STRUCTURAL RELATIONSHIPS (Static Analysis)                           ║ │
│  ╠═══════════════════════════════════════════════════════════════════════╣ │
│  ║                                                                       ║ │
│  ║  :CONTAINS      →  Module/Class contains classes/methods              ║ │
│  ║  :IMPORTS       →  File imports another module/file                   ║ │
│  ║  :EXTENDS       →  Class extends another class                        ║ │
│  ║  :IMPLEMENTS    →  Class implements interface                         ║ │
│  ║  :CALLS         →  Method calls another method                        ║ │
│  ║  :USES          →  Method uses a class/variable                       ║ │
│  ║  :RETURNS       →  Method returns a type                              ║ │
│  ║  :DEPENDS_ON    →  Module depends on external package                 ║ │
│  ║  :OVERRIDES     →  Method overrides parent method                     ║ │
│  ║                                                                       ║ │
│  ╚═══════════════════════════════════════════════════════════════════════╝ │
│                                                                             │
│  ╔═══════════════════════════════════════════════════════════════════════╗ │
│  ║  TEMPORAL RELATIONSHIPS (Git History)                                 ║ │
│  ╠═══════════════════════════════════════════════════════════════════════╣ │
│  ║                                                                       ║ │
│  ║  :MODIFIED      →  Commit modified a file/class/method                ║ │
│  ║  :AUTHORED      →  Author created a commit                            ║ │
│  ║  :CO_CHANGED    →  Files frequently changed together (coupling)       ║ │
│  ║  :PARENT        →  Commit has parent commit                           ║ │
│  ║  :INTRODUCED    →  Commit introduced a code entity                    ║ │
│  ║  :DELETED       →  Commit deleted a code entity                       ║ │
│  ║                                                                       ║ │
│  ╚═══════════════════════════════════════════════════════════════════════╝ │
│                                                                             │
│  ╔═══════════════════════════════════════════════════════════════════════╗ │
│  ║  SEMANTIC RELATIONSHIPS (Computed/Derived)                            ║ │
│  ╠═══════════════════════════════════════════════════════════════════════╣ │
│  ║                                                                       ║ │
│  ║  :COUPLED_WITH  →  Logical coupling score between entities            ║ │
│  ║  :SIMILAR_TO    →  Semantic similarity (embeddings)                   ║ │
│  ║  :TESTED_BY     →  Code entity tested by test                         ║ │
│  ║  :CORRELATES    →  Statistical correlation in changes                 ║ │
│  ║  :DUPLICATES    →  Code duplication relationship                      ║ │
│  ║  :REFACTORED_TO →  Refactoring relationship                           ║ │
│  ║                                                                       ║ │
│  ╚═══════════════════════════════════════════════════════════════════════╝ │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Relationship Properties

| Relationship | Properties |
|--------------|------------|
| `:CALLS` | `count`, `line_numbers[]`, `is_recursive` |
| `:CO_CHANGED` | `coupling_score`, `commit_count`, `support`, `confidence` |
| `:MODIFIED` | `lines_added`, `lines_removed`, `change_type` |
| `:COUPLED_WITH` | `temporal_coupling`, `structural_coupling`, `combined_score` |
| `:DEPENDS_ON` | `version_constraint`, `scope`, `optional` |

---

## 🏗️ Architecture

### Technology Stack

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         TECHNOLOGY STACK                                     │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  LAYER              TECHNOLOGY                  RATIONALE                   │
│  ─────────────────────────────────────────────────────────────────────────  │
│                                                                             │
│  Graph DB           Neo4j (primary)             • Mature, scalable          │
│                     + Apache AGE (PostgreSQL)   • Complex traversals        │
│                                                 • Cypher query language     │
│                                                                             │
│  Cache Layer        Redis                       • Fast lookups              │
│                     + Redis Graph               • Frequently accessed paths │
│                                                                             │
│  Vector Store       Qdrant / Pinecone           • Code embeddings           │
│                                                 • Semantic search           │
│                                                                             │
│  Search             Elasticsearch               • Full-text code search     │
│                                                 • Aggregations              │
│                                                                             │
│  Message Queue      Apache Kafka                • Event streaming           │
│                                                 • Async ingestion           │
│                                                                             │
│  API Layer          Python FastAPI              • Async support             │
│                     + Strawberry GraphQL        • Strong typing             │
│                                                                             │
│  Parsers            Tree-sitter                 • Multi-language            │
│                     + Language-specific AST     • Incremental parsing       │
│                                                                             │
│  Orchestration      Apache Airflow              • DAG-based pipelines       │
│                     or Prefect                  • Scheduling                │
│                                                                             │
│  Containerization   Docker + Kubernetes         • Scalability               │
│                                                 • Deployment                │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### System Components

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                                                                             │
│                            ┌─────────────────┐                              │
│                            │   API Gateway   │                              │
│                            │    (Kong/Nginx) │                              │
│                            └────────┬────────┘                              │
│                                     │                                       │
│           ┌─────────────────────────┼─────────────────────────┐             │
│           │                         │                         │             │
│           ▼                         ▼                         ▼             │
│  ┌─────────────────┐     ┌─────────────────┐      ┌─────────────────┐       │
│  │  Query Service  │     │ Ingestion Svc   │      │  Analysis Svc   │       │
│  │                 │     │                 │      │                 │       │
│  │ • GraphQL API   │     │ • Git Adapter   │      │ • Coupling Calc │       │
│  │ • REST API      │     │ • AST Parser    │      │ • Similarity    │       │
│  │ • Subscriptions │     │ • Dep Resolver  │      │ • Metrics       │       │
│  └────────┬────────┘     └────────┬────────┘      └────────┬────────┘       │
│           │                       │                        │                │
│           │              ┌────────▼────────┐               │                │
│           │              │  Message Queue  │               │                │
│           │              │    (Kafka)      │◄──────────────┘                │
│           │              └────────┬────────┘                                │
│           │                       │                                         │
│           │    ┌──────────────────┼──────────────────┐                      │
│           │    │                  │                  │                      │
│           ▼    ▼                  ▼                  ▼                      │
│     ┌───────────────┐    ┌───────────────┐   ┌───────────────┐              │
│     │    Neo4j      │    │    Redis      │   │    Qdrant     │              │
│     │  (Graph DB)   │    │   (Cache)     │   │  (Vectors)    │              │
│     └───────────────┘    └───────────────┘   └───────────────┘              │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 📁 Project Structure

```
code-graph/
├── 📂 src/
│   ├── 📂 adapters/                    # Data source adapters
│   │   ├── 📂 git/
│   │   │   ├── __init__.py
│   │   │   ├── git_adapter.py          # Git repository parsing
│   │   │   ├── commit_parser.py        # Commit extraction
│   │   │   └── diff_analyzer.py        # Change detection
│   │   ├── 📂 ast/
│   │   │   ├── __init__.py
│   │   │   ├── parser_factory.py       # Language-specific parsers
│   │   │   ├── python_parser.py
│   │   │   ├── java_parser.py
│   │   │   ├── typescript_parser.py
│   │   │   └── tree_sitter_adapter.py
│   │   ├── 📂 dependencies/
│   │   │   ├── __init__.py
│   │   │   ├── npm_resolver.py
│   │   │   ├── pip_resolver.py
│   │   │   ├── maven_resolver.py
│   │   │   └── cargo_resolver.py
│   │   └── 📂 external/
│   │       ├── __init__.py
│   │       ├── github_adapter.py       # GitHub API integration
│   │       ├── jira_adapter.py         # Issue tracking
│   │       └── sonar_adapter.py        # Code quality metrics
│   │
│   ├── 📂 core/                        # Core domain logic
│   │   ├── __init__.py
│   │   ├── 📂 models/
│   │   │   ├── __init__.py
│   │   │   ├── nodes.py                # Node type definitions
│   │   │   ├── relationships.py        # Edge type definitions
│   │   │   └── graph.py                # Graph operations
│   │   ├── 📂 services/
│   │   │   ├── __init__.py
│   │   │   ├── coupling_service.py     # Coupling analysis
│   │   │   ├── dependency_service.py   # Dependency analysis
│   │   │   ├── history_service.py      # Git history analysis
│   │   │   └── search_service.py       # Search operations
│   │   └── 📂 algorithms/
│   │       ├── __init__.py
│   │       ├── coupling.py             # Coupling algorithms
│   │       ├── community.py            # Community detection
│   │       ├── centrality.py           # Centrality metrics
│   │       └── similarity.py           # Similarity computation
│   │
│   ├── 📂 infrastructure/              # Infrastructure layer
│   │   ├── __init__.py
│   │   ├── 📂 database/
│   │   │   ├── __init__.py
│   │   │   ├── neo4j_client.py         # Neo4j connection
│   │   │   ├── redis_client.py         # Redis cache
│   │   │   └── qdrant_client.py        # Vector store
│   │   ├── 📂 messaging/
│   │   │   ├── __init__.py
│   │   │   ├── kafka_producer.py
│   │   │   └── kafka_consumer.py
│   │   └── 📂 config/
│   │       ├── __init__.py
│   │       └── settings.py             # Configuration
│   │
│   ├── 📂 api/                         # API layer
│   │   ├── __init__.py
│   │   ├── 📂 graphql/
│   │   │   ├── __init__.py
│   │   │   ├── schema.py               # GraphQL schema
│   │   │   ├── resolvers.py            # Query resolvers
│   │   │   └── mutations.py            # Mutations
│   │   ├── 📂 rest/
│   │   │   ├── __init__.py
│   │   │   ├── routes.py               # REST endpoints
│   │   │   └── controllers.py
│   │   └── main.py                     # FastAPI app
│   │
│   └── 📂 cli/                         # Command-line interface
│       ├── __init__.py
│       ├── main.py
│       └── commands/
│           ├── __init__.py
│           ├── ingest.py               # Ingestion commands
│           ├── query.py                # Query commands
│           └── analyze.py              # Analysis commands
│
├── 📂 tests/
│   ├── 📂 unit/
│   ├── 📂 integration/
│   └── 📂 e2e/
│
├── 📂 pipelines/                       # ETL pipelines
│   ├── dags/
│   │   ├── full_sync_dag.py
│   │   ├── incremental_dag.py
│   │   └── analysis_dag.py
│   └── tasks/
│
├── 📂 docker/
│   ├── Dockerfile
│   ├── docker-compose.yml
│   └── docker-compose.dev.yml
│
├── 📂 k8s/                             # Kubernetes manifests
│   ├── deployment.yaml
│   ├── service.yaml
│   └── configmap.yaml
│
├── 📂 docs/
│   ├── api.md
│   ├── architecture.md
│   └── algorithms.md
│
├── pyproject.toml
├── requirements.txt
└── README.md
```

---

## 🔌 API Design

### GraphQL Schema

```graphql
# ═══════════════════════════════════════════════════════════════════════════
#                           GRAPHQL SCHEMA
# ═══════════════════════════════════════════════════════════════════════════

# ─────────────────────────────────────────────────────────────────────────────
# TYPES
# ─────────────────────────────────────────────────────────────────────────────

type CodeEntity {
  id: ID!
  type: EntityType!
  name: String!
  qualifiedName: String!
  filePath: String!
  lineStart: Int
  lineEnd: Int
  metadata: JSON
}

enum EntityType {
  MODULE
  CLASS
  METHOD
  FUNCTION
  INTERFACE
  FILE
  PACKAGE
}

type Class implements CodeEntity {
  id: ID!
  type: EntityType!
  name: String!
  qualifiedName: String!
  filePath: String!
  lineStart: Int
  lineEnd: Int
  visibility: Visibility!
  isAbstract: Boolean!
  
  # Relationships
  methods: [Method!]!
  extends: Class
  implements: [Interface!]!
  usedBy: [CodeEntity!]!
  dependencies: [Dependency!]!
  
  # History
  history: ChangeHistory!
  authors: [Author!]!
  
  # Coupling
  coupledWith(minScore: Float): [CouplingRelation!]!
}

type Method implements CodeEntity {
  id: ID!
  type: EntityType!
  name: String!
  qualifiedName: String!
  signature: String!
  filePath: String!
  lineStart: Int
  lineEnd: Int
  visibility: Visibility!
  isStatic: Boolean!
  isAsync: Boolean!
  
  # Relationships
  calls: [MethodCall!]!
  calledBy: [MethodCall!]!
  overrides: Method
  overriddenBy: [Method!]!
  parameters: [Parameter!]!
  returnType: TypeReference
  
  # History
  history: ChangeHistory!
  
  # Metrics
  complexity: Int
  linesOfCode: Int
}

type ChangeHistory {
  commits: [Commit!]!
  totalChanges: Int!
  lastModified: DateTime!
  createdAt: DateTime!
  churnScore: Float!
  authors: [AuthorContribution!]!
}

type Commit {
  sha: String!
  message: String!
  author: Author!
  timestamp: DateTime!
  stats: CommitStats!
  affectedEntities: [CodeEntity!]!
  coChangedWith: [CoChangeRelation!]!
}

type CouplingRelation {
  entity: CodeEntity!
  temporalCoupling: Float!
  structuralCoupling: Float!
  combinedScore: Float!
  coChangeCount: Int!
  evidence: [Commit!]!
}

type Dependency {
  source: CodeEntity!
  target: CodeEntity!
  type: DependencyType!
  isDirectImport: Boolean!
  usageCount: Int!
}

# ─────────────────────────────────────────────────────────────────────────────
# QUERIES
# ─────────────────────────────────────────────────────────────────────────────

type Query {
  # Entity lookups
  entity(id: ID!): CodeEntity
  entityByName(qualifiedName: String!): CodeEntity
  
  # Search
  search(query: String!, types: [EntityType!], limit: Int): [SearchResult!]!
  semanticSearch(query: String!, limit: Int): [SemanticResult!]!
  
  # Dependency analysis
  dependencies(entityId: ID!, depth: Int, direction: Direction): DependencyGraph!
  impactAnalysis(entityId: ID!): ImpactReport!
  
  # Coupling analysis
  coupling(entityId: ID!, minScore: Float, limit: Int): [CouplingRelation!]!
  hotspots(minChurn: Float, minCoupling: Float): [Hotspot!]!
  
  # History
  history(entityId: ID!, since: DateTime, until: DateTime): ChangeHistory!
  blame(filePath: String!): [BlameLine!]!
  
  # Authors
  author(email: String!): Author
  contributions(authorEmail: String!): ContributionReport!
  
  # Graph algorithms
  connectedComponents: [Component!]!
  shortestPath(from: ID!, to: ID!): [CodeEntity!]
  centralityRanking(algorithm: CentralityAlgorithm): [RankedEntity!]!
}

# ─────────────────────────────────────────────────────────────────────────────
# MUTATIONS
# ─────────────────────────────────────────────────────────────────────────────

type Mutation {
  # Repository management
  addRepository(url: String!, branch: String): Repository!
  syncRepository(id: ID!, full: Boolean): SyncJob!
  removeRepository(id: ID!): Boolean!
  
  # Manual annotations
  addTag(entityId: ID!, tag: String!): CodeEntity!
  addNote(entityId: ID!, note: String!): CodeEntity!
  
  # Analysis triggers
  recomputeCoupling(repositoryId: ID!): AnalysisJob!
  refreshEmbeddings(repositoryId: ID!): AnalysisJob!
}

# ─────────────────────────────────────────────────────────────────────────────
# SUBSCRIPTIONS
# ─────────────────────────────────────────────────────────────────────────────

type Subscription {
  entityChanged(repositoryId: ID!): EntityChange!
  syncProgress(jobId: ID!): SyncProgress!
  analysisComplete(jobId: ID!): AnalysisResult!
}
```

### REST API Endpoints

```yaml
# ═══════════════════════════════════════════════════════════════════════════
#                           REST API ENDPOINTS
# ═══════════════════════════════════════════════════════════════════════════

openapi: 3.0.3
info:
  title: Code Graph API
  version: 1.0.0

paths:
  # ─────────────────────────────────────────────────────────────────────────
  # REPOSITORY MANAGEMENT
  # ─────────────────────────────────────────────────────────────────────────
  
  /api/v1/repositories:
    get:
      summary: List all repositories
      responses:
        200:
          content:
            application/json:
              schema:
                type: array
                items:
                  $ref: '#/components/schemas/Repository'
    post:
      summary: Add a new repository
      requestBody:
        content:
          application/json:
            schema:
              type: object
              properties:
                url: { type: string }
                branch: { type: string }
                auth: { $ref: '#/components/schemas/AuthConfig' }

  /api/v1/repositories/{id}/sync:
    post:
      summary: Trigger repository sync
      parameters:
        - name: full
          in: query
          schema: { type: boolean, default: false }

  # ─────────────────────────────────────────────────────────────────────────
  # ENTITY OPERATIONS
  # ─────────────────────────────────────────────────────────────────────────

  /api/v1/entities/{id}:
    get:
      summary: Get entity by ID
      responses:
        200:
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/CodeEntity'

  /api/v1/entities/{id}/usages:
    get:
      summary: Get all usages of an entity
      parameters:
        - name: depth
          in: query
          schema: { type: integer, default: 1 }

  /api/v1/entities/{id}/dependencies:
    get:
      summary: Get dependencies of an entity
      parameters:
        - name: direction
          in: query
          schema:
            type: string
            enum: [incoming, outgoing, both]

  /api/v1/entities/{id}/coupling:
    get:
      summary: Get coupling relationships
      parameters:
        - name: min_score
          in: query
          schema: { type: number, default: 0.5 }
        - name: limit
          in: query
          schema: { type: integer, default: 20 }

  /api/v1/entities/{id}/history:
    get:
      summary: Get change history
      parameters:
        - name: since
          in: query
          schema: { type: string, format: date-time }
        - name: until
          in: query
          schema: { type: string, format: date-time }

  # ─────────────────────────────────────────────────────────────────────────
  # SEARCH & ANALYSIS
  # ─────────────────────────────────────────────────────────────────────────

  /api/v1/search:
    get:
      summary: Search entities
      parameters:
        - name: q
          in: query
          required: true
          schema: { type: string }
        - name: type
          in: query
          schema:
            type: array
            items: { type: string }

  /api/v1/search/semantic:
    post:
      summary: Semantic code search
      requestBody:
        content:
          application/json:
            schema:
              type: object
              properties:
                query: { type: string }
                limit: { type: integer }

  /api/v1/analysis/hotspots:
    get:
      summary: Get code hotspots
      parameters:
        - name: min_churn
          in: query
          schema: { type: number }
        - name: min_coupling
          in: query
          schema: { type: number }

  /api/v1/analysis/impact:
    post:
      summary: Impact analysis
      requestBody:
        content:
          application/json:
            schema:
              type: object
              properties:
                entities: 
                  type: array
                  items: { type: string }
```

---

## 🧮 Algorithms

### 1. Temporal Coupling Calculation

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                    TEMPORAL COUPLING ALGORITHM                               │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  The temporal coupling between two entities measures how often they         │
│  change together in the same commit.                                        │
│                                                                             │
│  ┌───────────────────────────────────────────────────────────────────────┐ │
│  │                                                                       │ │
│  │   Support(A, B) = count(commits containing both A and B)              │ │
│  │                                                                       │ │
│  │   Confidence(A → B) = Support(A, B) / count(commits containing A)     │ │
│  │                                                                       │ │
│  │   Coupling(A, B) = 2 * Support(A, B)                                  │ │
│  │                    ─────────────────────────────────────              │ │
│  │                    count(A) + count(B)                                │ │
│  │                                                                       │ │
│  └───────────────────────────────────────────────────────────────────────┘ │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

**Pseudo-code:**

```python
def calculate_temporal_coupling(commits: List[Commit]) -> Dict[Tuple[str, str], CouplingScore]:
    """
    Calculate temporal coupling between all pairs of files/entities.
    
    Algorithm:
    1. Build a co-occurrence matrix from commits
    2. Calculate support (co-change count) for each pair
    3. Calculate confidence and coupling scores
    4. Filter by minimum thresholds
    """
    
    # Step 1: Build occurrence counts
    entity_commits = defaultdict(set)      # entity -> set of commit SHAs
    commit_entities = defaultdict(set)     # commit SHA -> set of entities
    
    for commit in commits:
        for entity in commit.modified_entities:
            entity_commits[entity].add(commit.sha)
            commit_entities[commit.sha].add(entity)
    
    # Step 2: Calculate co-occurrence (support)
    co_occurrence = defaultdict(int)
    
    for commit_sha, entities in commit_entities.items():
        entities_list = list(entities)
        for i in range(len(entities_list)):
            for j in range(i + 1, len(entities_list)):
                pair = tuple(sorted([entities_list[i], entities_list[j]]))
                co_occurrence[pair] += 1
    
    # Step 3: Calculate coupling scores
    coupling_scores = {}
    
    for (entity_a, entity_b), support in co_occurrence.items():
        count_a = len(entity_commits[entity_a])
        count_b = len(entity_commits[entity_b])
        
        # Dice coefficient for symmetric coupling
        coupling = (2 * support) / (count_a + count_b)
        
        # Confidence scores (asymmetric)
        confidence_a_to_b = support / count_a
        confidence_b_to_a = support / count_b
        
        coupling_scores[(entity_a, entity_b)] = CouplingScore(
            support=support,
            coupling=coupling,
            confidence_a_to_b=confidence_a_to_b,
            confidence_b_to_a=confidence_b_to_a
        )
    
    return coupling_scores
```

### 2. Structural Coupling Analysis

```python
def calculate_structural_coupling(graph: Graph, entity_id: str) -> List[StructuralCoupling]:
    """
    Calculate structural coupling based on static dependencies.
    
    Metrics:
    - Afferent coupling (Ca): incoming dependencies
    - Efferent coupling (Ce): outgoing dependencies  
    - Instability (I): Ce / (Ca + Ce)
    """
    
    # Get direct dependencies
    outgoing = graph.query("""
        MATCH (e:Entity {id: $id})-[r:CALLS|USES|IMPORTS]->(target)
        RETURN target, type(r) as rel_type, count(r) as weight
    """, id=entity_id)
    
    incoming = graph.query("""
        MATCH (source)-[r:CALLS|USES|IMPORTS]->(e:Entity {id: $id})
        RETURN source, type(r) as rel_type, count(r) as weight
    """, id=entity_id)
    
    ca = sum(r['weight'] for r in incoming)  # Afferent coupling
    ce = sum(r['weight'] for r in outgoing)  # Efferent coupling
    
    instability = ce / (ca + ce) if (ca + ce) > 0 else 0
    
    return StructuralMetrics(
        afferent_coupling=ca,
        efferent_coupling=ce,
        instability=instability,
        incoming_entities=[r['source'] for r in incoming],
        outgoing_entities=[r['target'] for r in outgoing]
    )
```

### 3. Combined Coupling Score

```python
def calculate_combined_coupling(
    entity_a: str, 
    entity_b: str,
    temporal_coupling: float,
    structural_coupling: float,
    weights: CouplingWeights = CouplingWeights(temporal=0.6, structural=0.4)
) -> float:
    """
    Combine temporal and structural coupling into a single score.
    
    The combined score weighs both types of coupling, with temporal
    typically weighted higher as it captures emergent behavior.
    """
    
    combined = (
        weights.temporal * temporal_coupling +
        weights.structural * structural_coupling
    )
    
    return min(combined, 1.0)  # Normalize to [0, 1]
```

### 4. Hotspot Detection

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         HOTSPOT DETECTION                                    │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  Hotspots are code areas that are:                                          │
│  1. Complex (high cyclomatic complexity)                                    │
│  2. Frequently changed (high churn)                                         │
│  3. Highly coupled (many dependencies)                                      │
│                                                                             │
│  ┌───────────────────────────────────────────────────────────────────────┐ │
│  │                                                                       │ │
│  │   Hotspot Score = α * normalized(complexity)                          │ │
│  │                 + β * normalized(churn)                               │ │
│  │                 + γ * normalized(coupling)                            │ │
│  │                                                                       │ │
│  │   Where α + β + γ = 1                                                 │ │
│  │                                                                       │ │
│  └───────────────────────────────────────────────────────────────────────┘ │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

```python
def detect_hotspots(
    graph: Graph,
    min_score: float = 0.7,
    weights: HotspotWeights = HotspotWeights(
        complexity=0.3,
        churn=0.4,
        coupling=0.3
    )
) -> List[Hotspot]:
    """
    Detect code hotspots by combining multiple metrics.
    
    Algorithm:
    1. Gather metrics for all entities
    2. Normalize each metric to [0, 1]
    3. Calculate weighted score
    4. Rank and filter by threshold
    """
    
    # Query all entities with metrics
    entities = graph.query("""
        MATCH (e:Entity)
        WHERE e.type IN ['CLASS', 'METHOD', 'FILE']
        OPTIONAL MATCH (e)<-[:MODIFIED]-(c:Commit)
        WITH e, count(c) as change_count
        OPTIONAL MATCH (e)-[:COUPLED_WITH]-(other)
        WITH e, change_count, count(other) as coupling_count
        RETURN e.id as id,
               e.name as name,
               e.complexity as complexity,
               change_count,
               coupling_count
    """)
    
    # Normalize metrics
    complexities = [e['complexity'] or 0 for e in entities]
    churns = [e['change_count'] for e in entities]
    couplings = [e['coupling_count'] for e in entities]
    
    max_complexity = max(complexities) or 1
    max_churn = max(churns) or 1
    max_coupling = max(couplings) or 1
    
    hotspots = []
    
    for entity in entities:
        norm_complexity = (entity['complexity'] or 0) / max_complexity
        norm_churn = entity['change_count'] / max_churn
        norm_coupling = entity['coupling_count'] / max_coupling
        
        score = (
            weights.complexity * norm_complexity +
            weights.churn * norm_churn +
            weights.coupling * norm_coupling
        )
        
        if score >= min_score:
            hotspots.append(Hotspot(
                entity_id=entity['id'],
                name=entity['name'],
                score=score,
                metrics=HotspotMetrics(
                    complexity=entity['complexity'],
                    churn=entity['change_count'],
                    coupling=entity['coupling_count']
                )
            ))
    
    return sorted(hotspots, key=lambda h: h.score, reverse=True)
```

### 5. Impact Analysis

```python
def analyze_impact(
    graph: Graph,
    entity_id: str,
    max_depth: int = 3
) -> ImpactReport:
    """
    Analyze the potential impact of changing an entity.
    
    Algorithm:
    1. Find all entities that depend on the target (incoming edges)
    2. Traverse transitively up to max_depth
    3. Weight impact by coupling strength and distance
    4. Group by risk level
    """
    
    # BFS traversal for impact
    impacted = []
    visited = set()
    queue = [(entity_id, 0)]  # (entity, depth)
    
    while queue:
        current_id, depth = queue.pop(0)
        
        if current_id in visited or depth > max_depth:
            continue
        
        visited.add(current_id)
        
        # Find dependents
        dependents = graph.query("""
            MATCH (source)-[r:CALLS|USES|IMPORTS|EXTENDS|IMPLEMENTS]->(e:Entity {id: $id})
            RETURN source.id as id, 
                   source.name as name,
                   type(r) as relationship,
                   r.weight as weight
        """, id=current_id)
        
        for dep in dependents:
            if dep['id'] not in visited:
                impact_score = calculate_impact_score(
                    relationship=dep['relationship'],
                    weight=dep['weight'] or 1,
                    depth=depth + 1
                )
                
                impacted.append(ImpactedEntity(
                    entity_id=dep['id'],
                    name=dep['name'],
                    relationship=dep['relationship'],
                    depth=depth + 1,
                    impact_score=impact_score,
                    risk_level=categorize_risk(impact_score)
                ))
                
                queue.append((dep['id'], depth + 1))
    
    return ImpactReport(
        target_entity=entity_id,
        total_impacted=len(impacted),
        impacted_entities=impacted,
        by_risk_level=group_by_risk(impacted)
    )


def calculate_impact_score(relationship: str, weight: int, depth: int) -> float:
    """
    Calculate impact score based on relationship type, usage count, and distance.
    
    Closer dependencies and stronger relationships = higher impact
    """
    relationship_weights = {
        'EXTENDS': 1.0,      # Inheritance is highest impact
        'IMPLEMENTS': 0.9,   # Interface implementation
        'CALLS': 0.7,        # Method calls
        'USES': 0.5,         # Field/variable usage
        'IMPORTS': 0.3       # Import (may not use)
    }
    
    rel_weight = relationship_weights.get(relationship, 0.5)
    distance_decay = 1 / (depth ** 1.5)  # Decay with distance
    
    return rel_weight * distance_decay * min(weight / 10, 1.0)
```

---

## 🔧 Implementation Guide

### Phase 1: Core Infrastructure (Weeks 1-3)

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         PHASE 1: INFRASTRUCTURE                              │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  Week 1: Database Setup                                                     │
│  ─────────────────────                                                      │
│  □ Set up Neo4j cluster with Docker Compose                                 │
│  □ Implement Neo4j connection pool and query wrapper                        │
│  □ Create initial schema (constraints, indexes)                             │
│  □ Set up Redis cache with TTL policies                                     │
│                                                                             │
│  Week 2: Core Models                                                        │
│  ─────────────────────                                                      │
│  □ Define Pydantic models for all node types                                │
│  □ Define relationship models with properties                               │
│  □ Implement graph abstraction layer                                        │
│  □ Create repository pattern for graph operations                           │
│                                                                             │
│  Week 3: Basic API                                                          │
│  ─────────────────────                                                      │
│  □ Set up FastAPI project structure                                         │
│  □ Implement health checks and metrics                                      │
│  □ Create basic CRUD endpoints for entities                                 │
│  □ Add authentication middleware                                            │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Phase 2: Data Ingestion (Weeks 4-7)

```python
# ═══════════════════════════════════════════════════════════════════════════
# PHASE 2: DATA INGESTION IMPLEMENTATION
# ═══════════════════════════════════════════════════════════════════════════

# ─────────────────────────────────────────────────────────────────────────────
# Git Adapter Implementation
# ─────────────────────────────────────────────────────────────────────────────

class GitAdapter:
    """
    Adapter for extracting code graph data from Git repositories.
    """
    
    def __init__(self, repo_path: str):
        self.repo = git.Repo(repo_path)
        
    async def extract_commits(
        self, 
        since: Optional[datetime] = None,
        until: Optional[datetime] = None
    ) -> AsyncIterator[CommitData]:
        """
        Extract commits with file changes.
        
        Yields CommitData objects with:
        - SHA, message, author, timestamp
        - List of modified files with diff stats
        """
        
        for commit in self.repo.iter_commits(since=since, until=until):
            modified_files = []
            
            # Get diff stats
            if commit.parents:
                diff = commit.parents[0].diff(commit)
                for change in diff:
                    modified_files.append(FileChange(
                        path=change.b_path or change.a_path,
                        change_type=change.change_type,
                        lines_added=change.diff.count('\n+'),
                        lines_removed=change.diff.count('\n-')
                    ))
            
            yield CommitData(
                sha=commit.hexsha,
                message=commit.message,
                author=AuthorData(
                    name=commit.author.name,
                    email=commit.author.email
                ),
                timestamp=commit.committed_datetime,
                modified_files=modified_files
            )
    
    async def extract_file_history(self, file_path: str) -> List[CommitData]:
        """
        Get complete history for a specific file.
        """
        commits = []
        for commit in self.repo.iter_commits(paths=file_path):
            commits.append(await self._parse_commit(commit))
        return commits


# ─────────────────────────────────────────────────────────────────────────────
# AST Parser Implementation
# ─────────────────────────────────────────────────────────────────────────────

class ASTParserFactory:
    """
    Factory for creating language-specific AST parsers.
    """
    
    _parsers: Dict[str, Type[BaseParser]] = {
        'python': PythonParser,
        'java': JavaParser,
        'typescript': TypeScriptParser,
        'javascript': JavaScriptParser,
        'go': GoParser,
        'rust': RustParser,
    }
    
    @classmethod
    def get_parser(cls, language: str) -> BaseParser:
        parser_class = cls._parsers.get(language)
        if not parser_class:
            # Fallback to tree-sitter generic parser
            return TreeSitterParser(language)
        return parser_class()


class PythonParser(BaseParser):
    """
    Python-specific AST parser using ast module + tree-sitter for robustness.
    """
    
    async def parse_file(self, file_path: str) -> FileGraph:
        """
        Parse a Python file into a graph structure.
        
        Returns:
        - Classes with methods, attributes
        - Functions with parameters, return types
        - Import relationships
        - Call graph edges
        """
        
        with open(file_path, 'r') as f:
            source = f.read()
        
        tree = ast.parse(source)
        file_graph = FileGraph(path=file_path)
        
        for node in ast.walk(tree):
            if isinstance(node, ast.ClassDef):
                class_node = self._parse_class(node, file_path)
                file_graph.add_node(class_node)
                
            elif isinstance(node, ast.FunctionDef):
                func_node = self._parse_function(node, file_path)
                file_graph.add_node(func_node)
                
            elif isinstance(node, ast.Import):
                for alias in node.names:
                    file_graph.add_import(alias.name)
                    
            elif isinstance(node, ast.ImportFrom):
                module = node.module or ''
                for alias in node.names:
                    file_graph.add_import(f"{module}.{alias.name}")
        
        # Extract call relationships
        call_visitor = CallVisitor()
        call_visitor.visit(tree)
        
        for caller, callee in call_visitor.calls:
            file_graph.add_edge(caller, callee, 'CALLS')
        
        return file_graph
    
    def _parse_class(self, node: ast.ClassDef, file_path: str) -> ClassNode:
        """Extract class information."""
        
        methods = []
        for item in node.body:
            if isinstance(item, ast.FunctionDef):
                methods.append(self._parse_method(item, node.name))
        
        bases = [self._get_name(base) for base in node.bases]
        
        return ClassNode(
            name=node.name,
            qualified_name=f"{file_path}:{node.name}",
            file_path=file_path,
            line_start=node.lineno,
            line_end=node.end_lineno,
            methods=methods,
            bases=bases,
            decorators=[self._get_name(d) for d in node.decorator_list]
        )


# ─────────────────────────────────────────────────────────────────────────────
# Ingestion Pipeline
# ─────────────────────────────────────────────────────────────────────────────

class IngestionPipeline:
    """
    Main pipeline for ingesting repository data into the graph.
    """
    
    def __init__(
        self,
        graph_client: Neo4jClient,
        git_adapter: GitAdapter,
        parser_factory: ASTParserFactory,
        kafka_producer: KafkaProducer
    ):
        self.graph = graph_client
        self.git = git_adapter
        self.parsers = parser_factory
        self.kafka = kafka_producer
    
    async def full_sync(self, repo_path: str) -> SyncResult:
        """
        Perform full repository sync.
        
        Steps:
        1. Parse all source files
        2. Extract git history
        3. Build graph
        4. Calculate coupling scores
        """
        
        result = SyncResult(started_at=datetime.now())
        
        # Step 1: Parse source files
        source_files = await self._discover_source_files(repo_path)
        
        for file_path in source_files:
            language = detect_language(file_path)
            parser = self.parsers.get_parser(language)
            
            try:
                file_graph = await parser.parse_file(file_path)
                await self._ingest_file_graph(file_graph)
                result.files_processed += 1
            except ParseError as e:
                result.errors.append(FileError(path=file_path, error=str(e)))
        
        # Step 2: Extract git history
        async for commit in self.git.extract_commits():
            await self._ingest_commit(commit)
            result.commits_processed += 1
        
        # Step 3: Calculate coupling (async job)
        await self.kafka.send('analysis.coupling', {
            'repo_path': repo_path,
            'type': 'full'
        })
        
        result.completed_at = datetime.now()
        return result
    
    async def _ingest_file_graph(self, file_graph: FileGraph) -> None:
        """Ingest file graph into Neo4j."""
        
        # Create file node
        await self.graph.execute("""
            MERGE (f:File {path: $path})
            SET f.language = $language,
                f.loc = $loc,
                f.last_modified = $modified
        """, path=file_graph.path, language=file_graph.language, 
             loc=file_graph.loc, modified=file_graph.modified)
        
        # Create entity nodes and relationships
        for node in file_graph.nodes:
            await self._create_entity_node(node)
        
        for edge in file_graph.edges:
            await self._create_relationship(edge)
```

### Phase 3: Analysis & Algorithms (Weeks 8-10)

```python
# ═══════════════════════════════════════════════════════════════════════════
# PHASE 3: ANALYSIS SERVICES
# ═══════════════════════════════════════════════════════════════════════════

class CouplingService:
    """
    Service for computing and querying coupling relationships.
    """
    
    def __init__(self, graph: Neo4jClient, cache: RedisClient):
        self.graph = graph
        self.cache = cache
    
    async def compute_temporal_coupling(
        self,
        repository_id: str,
        min_support: int = 3,
        min_confidence: float = 0.3
    ) -> int:
        """
        Compute temporal coupling for all entity pairs.
        
        This is a batch operation that:
        1. Queries all commits and their affected entities
        2. Computes co-occurrence matrix
        3. Creates COUPLED_WITH relationships
        
        Returns number of coupling relationships created.
        """
        
        # Batch compute using Cypher
        result = await self.graph.execute("""
            // Find all co-changes
            MATCH (c:Commit)-[:MODIFIED]->(e1:Entity)
            MATCH (c)-[:MODIFIED]->(e2:Entity)
            WHERE id(e1) < id(e2)
            
            WITH e1, e2, count(c) as support
            WHERE support >= $min_support
            
            // Calculate coupling metrics
            MATCH (c1:Commit)-[:MODIFIED]->(e1)
            WITH e1, e2, support, count(c1) as e1_count
            
            MATCH (c2:Commit)-[:MODIFIED]->(e2)
            WITH e1, e2, support, e1_count, count(c2) as e2_count
            
            WITH e1, e2, support,
                 toFloat(support) / e1_count as confidence_1_2,
                 toFloat(support) / e2_count as confidence_2_1,
                 toFloat(2 * support) / (e1_count + e2_count) as coupling
            
            WHERE coupling >= $min_confidence
            
            // Create relationship
            MERGE (e1)-[r:COUPLED_WITH]-(e2)
            SET r.temporal_coupling = coupling,
                r.support = support,
                r.confidence_1_to_2 = confidence_1_2,
                r.confidence_2_to_1 = confidence_2_1,
                r.computed_at = datetime()
            
            RETURN count(r) as created
        """, min_support=min_support, min_confidence=min_confidence)
        
        return result[0]['created']
    
    async def get_coupled_entities(
        self,
        entity_id: str,
        min_score: float = 0.5,
        limit: int = 20
    ) -> List[CouplingResult]:
        """
        Get entities coupled with the given entity.
        """
        
        # Check cache first
        cache_key = f"coupling:{entity_id}:{min_score}"
        cached = await self.cache.get(cache_key)
        if cached:
            return [CouplingResult(**r) for r in json.loads(cached)]
        
        results = await self.graph.execute("""
            MATCH (e:Entity {id: $id})-[r:COUPLED_WITH]-(other)
            WHERE r.temporal_coupling >= $min_score
            
            OPTIONAL MATCH (e)-[s:CALLS|USES]-(other)
            WITH other, r, count(s) as structural_weight
            
            WITH other, r, 
                 r.temporal_coupling * 0.6 + 
                 CASE WHEN structural_weight > 0 
                      THEN least(structural_weight / 10.0, 1.0) * 0.4 
                      ELSE 0 
                 END as combined_score
            
            ORDER BY combined_score DESC
            LIMIT $limit
            
            RETURN other.id as entity_id,
                   other.name as name,
                   other.type as type,
                   r.temporal_coupling as temporal,
                   r.support as support,
                   combined_score
        """, id=entity_id, min_score=min_score, limit=limit)
        
        coupling_results = [CouplingResult(**r) for r in results]
        
        # Cache for 5 minutes
        await self.cache.setex(cache_key, 300, json.dumps([r.dict() for r in coupling_results]))
        
        return coupling_results


class DependencyService:
    """
    Service for analyzing code dependencies.
    """
    
    async def get_dependency_tree(
        self,
        entity_id: str,
        direction: str = 'outgoing',
        max_depth: int = 3
    ) -> DependencyTree:
        """
        Get dependency tree for an entity.
        """
        
        direction_pattern = {
            'outgoing': '(e)-[r:CALLS|USES|IMPORTS|DEPENDS_ON]->(dep)',
            'incoming': '(dep)-[r:CALLS|USES|IMPORTS|DEPENDS_ON]->(e)',
            'both': '(e)-[r:CALLS|USES|IMPORTS|DEPENDS_ON]-(dep)'
        }
        
        pattern = direction_pattern.get(direction, direction_pattern['outgoing'])
        
        results = await self.graph.execute(f"""
            MATCH (e:Entity {{id: $id}})
            CALL apoc.path.subgraphAll(e, {{
                relationshipFilter: 'CALLS>|USES>|IMPORTS>|DEPENDS_ON>',
                maxLevel: $depth
            }})
            YIELD nodes, relationships
            
            UNWIND nodes as node
            WITH collect(distinct node) as all_nodes, relationships
            
            UNWIND relationships as rel
            RETURN all_nodes,
                   collect(distinct {{
                       source: startNode(rel).id,
                       target: endNode(rel).id,
                       type: type(rel)
                   }}) as edges
        """, id=entity_id, depth=max_depth)
        
        return self._build_tree(results)
    
    async def find_circular_dependencies(self) -> List[CircularDependency]:
        """
        Detect circular dependencies in the codebase.
        """
        
        cycles = await self.graph.execute("""
            MATCH path = (e:Entity)-[:IMPORTS|DEPENDS_ON*2..10]->(e)
            WHERE all(n in nodes(path) WHERE n:Entity)
            WITH path, length(path) as cycle_length
            ORDER BY cycle_length
            LIMIT 100
            
            RETURN [n in nodes(path) | n.id] as cycle_entities,
                   cycle_length
        """)
        
        return [
            CircularDependency(
                entities=cycle['cycle_entities'],
                length=cycle['cycle_length']
            ) 
            for cycle in cycles
        ]
```

### Phase 4: API & UI (Weeks 11-14)

```python
# ═══════════════════════════════════════════════════════════════════════════
# PHASE 4: API IMPLEMENTATION
# ═══════════════════════════════════════════════════════════════════════════

# ─────────────────────────────────────────────────────────────────────────────
# FastAPI Application
# ─────────────────────────────────────────────────────────────────────────────

from fastapi import FastAPI, Depends, HTTPException
from strawberry.fastapi import GraphQLRouter
import strawberry

app = FastAPI(
    title="Code Graph API",
    version="1.0.0",
    description="Unified codebase knowledge graph API"
)

# ─────────────────────────────────────────────────────────────────────────────
# GraphQL Schema Implementation
# ─────────────────────────────────────────────────────────────────────────────

@strawberry.type
class CodeEntity:
    id: strawberry.ID
    name: str
    qualified_name: str
    entity_type: str
    file_path: str
    line_start: Optional[int]
    line_end: Optional[int]
    
    @strawberry.field
    async def usages(self, info, limit: int = 20) -> List['CodeEntity']:
        """Get all usages of this entity."""
        service = info.context['dependency_service']
        return await service.get_usages(self.id, limit=limit)
    
    @strawberry.field
    async def dependencies(
        self, 
        info,
        direction: str = 'outgoing',
        depth: int = 1
    ) -> List['Dependency']:
        """Get dependencies of this entity."""
        service = info.context['dependency_service']
        return await service.get_dependencies(self.id, direction, depth)
    
    @strawberry.field
    async def coupled_with(
        self,
        info,
        min_score: float = 0.5,
        limit: int = 20
    ) -> List['CouplingRelation']:
        """Get entities this is coupled with."""
        service = info.context['coupling_service']
        return await service.get_coupled_entities(self.id, min_score, limit)
    
    @strawberry.field
    async def history(
        self,
        info,
        since: Optional[datetime] = None,
        until: Optional[datetime] = None
    ) -> 'ChangeHistory':
        """Get change history for this entity."""
        service = info.context['history_service']
        return await service.get_history(self.id, since, until)


@strawberry.type
class Query:
    @strawberry.field
    async def entity(self, info, id: strawberry.ID) -> Optional[CodeEntity]:
        """Get entity by ID."""
        graph = info.context['graph']
        return await graph.get_entity(id)
    
    @strawberry.field
    async def search(
        self,
        info,
        query: str,
        types: Optional[List[str]] = None,
        limit: int = 20
    ) -> List[CodeEntity]:
        """Search for entities by name or content."""
        service = info.context['search_service']
        return await service.search(query, types, limit)
    
    @strawberry.field
    async def hotspots(
        self,
        info,
        min_score: float = 0.7,
        limit: int = 20
    ) -> List['Hotspot']:
        """Get code hotspots."""
        service = info.context['analysis_service']
        return await service.get_hotspots(min_score, limit)
    
    @strawberry.field
    async def impact_analysis(
        self,
        info,
        entity_id: strawberry.ID,
        max_depth: int = 3
    ) -> 'ImpactReport':
        """Analyze impact of changing an entity."""
        service = info.context['analysis_service']
        return await service.analyze_impact(entity_id, max_depth)


schema = strawberry.Schema(query=Query)
graphql_app = GraphQLRouter(schema)

app.include_router(graphql_app, prefix="/graphql")

# ─────────────────────────────────────────────────────────────────────────────
# REST Endpoints
# ─────────────────────────────────────────────────────────────────────────────

@app.get("/api/v1/entities/{entity_id}")
async def get_entity(
    entity_id: str,
    graph: Neo4jClient = Depends(get_graph_client)
) -> EntityResponse:
    """Get entity by ID."""
    entity = await graph.get_entity(entity_id)
    if not entity:
        raise HTTPException(status_code=404, detail="Entity not found")
    return EntityResponse.from_entity(entity)


@app.get("/api/v1/entities/{entity_id}/coupling")
async def get_coupling(
    entity_id: str,
    min_score: float = Query(0.5, ge=0, le=1),
    limit: int = Query(20, ge=1, le=100),
    coupling_service: CouplingService = Depends(get_coupling_service)
) -> List[CouplingResponse]:
    """Get coupling relationships for an entity."""
    return await coupling_service.get_coupled_entities(
        entity_id, 
        min_score=min_score, 
        limit=limit
    )


@app.post("/api/v1/repositories")
async def add_repository(
    request: AddRepositoryRequest,
    ingestion_service: IngestionService = Depends(get_ingestion_service)
) -> RepositoryResponse:
    """Add a new repository for analysis."""
    job = await ingestion_service.schedule_sync(
        url=request.url,
        branch=request.branch,
        auth=request.auth
    )
    return RepositoryResponse(
        id=job.repository_id,
        status="syncing",
        job_id=job.id
    )
```

---

## 📈 Cypher Query Examples

```cypher
-- ═══════════════════════════════════════════════════════════════════════════
--                        COMMON CYPHER QUERIES
-- ═══════════════════════════════════════════════════════════════════════════

-- ─────────────────────────────────────────────────────────────────────────────
-- Find all methods that call a specific method
-- ─────────────────────────────────────────────────────────────────────────────

MATCH (caller:Method)-[r:CALLS]->(target:Method {name: 'processPayment'})
RETURN caller.qualifiedName as caller,
       r.count as call_count,
       r.line_numbers as locations
ORDER BY r.count DESC

-- ─────────────────────────────────────────────────────────────────────────────
-- Get class hierarchy
-- ─────────────────────────────────────────────────────────────────────────────

MATCH path = (c:Class {name: 'PaymentService'})-[:EXTENDS*0..5]->(parent:Class)
RETURN path

-- ─────────────────────────────────────────────────────────────────────────────
-- Find highly coupled file pairs
-- ─────────────────────────────────────────────────────────────────────────────

MATCH (f1:File)-[r:CO_CHANGED]-(f2:File)
WHERE r.coupling_score > 0.7
RETURN f1.path as file1,
       f2.path as file2,
       r.coupling_score as coupling,
       r.commit_count as co_changes
ORDER BY r.coupling_score DESC
LIMIT 50

-- ─────────────────────────────────────────────────────────────────────────────
-- Get change history with authors
-- ─────────────────────────────────────────────────────────────────────────────

MATCH (c:Commit)-[m:MODIFIED]->(e:Entity {id: $entityId})
MATCH (a:Author)-[:AUTHORED]->(c)
RETURN c.sha as commit,
       c.message as message,
       c.timestamp as date,
       a.name as author,
       m.lines_added as added,
       m.lines_removed as removed
ORDER BY c.timestamp DESC

-- ─────────────────────────────────────────────────────────────────────────────
-- Find code hotspots (high churn + high complexity)
-- ─────────────────────────────────────────────────────────────────────────────

MATCH (e:Entity)<-[m:MODIFIED]-(c:Commit)
WITH e, count(c) as change_count
WHERE e.complexity IS NOT NULL
WITH e, change_count,
     e.complexity * 0.3 + (change_count / 100.0) * 0.7 as hotspot_score
WHERE hotspot_score > 0.5
RETURN e.name as entity,
       e.filePath as file,
       e.complexity as complexity,
       change_count as changes,
       hotspot_score as score
ORDER BY hotspot_score DESC
LIMIT 20

-- ─────────────────────────────────────────────────────────────────────────────
-- Impact analysis: what breaks if I change this?
-- ─────────────────────────────────────────────────────────────────────────────

MATCH (target:Entity {id: $entityId})
CALL apoc.path.subgraphAll(target, {
    relationshipFilter: '<CALLS|<USES|<IMPORTS|<EXTENDS|<IMPLEMENTS',
    maxLevel: 3
}) YIELD nodes, relationships

WITH nodes, relationships, target

UNWIND nodes as impacted
WHERE impacted <> target

OPTIONAL MATCH path = shortestPath((target)<-[*]-(impacted))

RETURN impacted.name as entity,
       impacted.type as type,
       impacted.filePath as file,
       length(path) as distance,
       [r in relationships(path) | type(r)] as via_relationships
ORDER BY distance
```

---

## 🐳 Docker Compose Setup

```yaml
# docker-compose.yml
version: '3.8'

services:
  # ─────────────────────────────────────────────────────────────────────────
  # Neo4j Graph Database
  # ─────────────────────────────────────────────────────────────────────────
  neo4j:
    image: neo4j:5.15-enterprise
    container_name: code-graph-neo4j
    ports:
      - "7474:7474"  # HTTP
      - "7687:7687"  # Bolt
    environment:
      - NEO4J_AUTH=neo4j/code-graph-secret
      - NEO4J_ACCEPT_LICENSE_AGREEMENT=yes
      - NEO4J_PLUGINS=["apoc", "graph-data-science"]
      - NEO4J_dbms_memory_heap_max__size=4G
      - NEO4J_dbms_memory_pagecache_size=2G
    volumes:
      - neo4j_data:/data
      - neo4j_logs:/logs
    healthcheck:
      test: ["CMD", "neo4j", "status"]
      interval: 10s
      timeout: 10s
      retries: 5

  # ─────────────────────────────────────────────────────────────────────────
  # Redis Cache
  # ─────────────────────────────────────────────────────────────────────────
  redis:
    image: redis:7-alpine
    container_name: code-graph-redis
    ports:
      - "6379:6379"
    volumes:
      - redis_data:/data
    command: redis-server --appendonly yes

  # ─────────────────────────────────────────────────────────────────────────
  # Qdrant Vector Database
  # ─────────────────────────────────────────────────────────────────────────
  qdrant:
    image: qdrant/qdrant:v1.7.0
    container_name: code-graph-qdrant
    ports:
      - "6333:6333"
    volumes:
      - qdrant_data:/qdrant/storage

  # ─────────────────────────────────────────────────────────────────────────
  # Kafka (Event Streaming)
  # ─────────────────────────────────────────────────────────────────────────
  kafka:
    image: confluentinc/cp-kafka:7.5.0
    container_name: code-graph-kafka
    ports:
      - "9092:9092"
    environment:
      KAFKA_NODE_ID: 1
      KAFKA_LISTENER_SECURITY_PROTOCOL_MAP: CONTROLLER:PLAINTEXT,PLAINTEXT:PLAINTEXT
      KAFKA_LISTENERS: PLAINTEXT://0.0.0.0:9092,CONTROLLER://0.0.0.0:9093
      KAFKA_ADVERTISED_LISTENERS: PLAINTEXT://localhost:9092
      KAFKA_PROCESS_ROLES: broker,controller
      KAFKA_CONTROLLER_QUORUM_VOTERS: 1@localhost:9093
      KAFKA_CONTROLLER_LISTENER_NAMES: CONTROLLER
      CLUSTER_ID: code-graph-cluster-001
    volumes:
      - kafka_data:/var/lib/kafka/data

  # ─────────────────────────────────────────────────────────────────────────
  # Code Graph API
  # ─────────────────────────────────────────────────────────────────────────
  api:
    build:
      context: .
      dockerfile: docker/Dockerfile
    container_name: code-graph-api
    ports:
      - "8000:8000"
    environment:
      - NEO4J_URI=bolt://neo4j:7687
      - NEO4J_USER=neo4j
      - NEO4J_PASSWORD=code-graph-secret
      - REDIS_URL=redis://redis:6379
      - QDRANT_URL=http://qdrant:6333
      - KAFKA_BOOTSTRAP_SERVERS=kafka:9092
    depends_on:
      neo4j:
        condition: service_healthy
      redis:
        condition: service_started
      qdrant:
        condition: service_started

  # ─────────────────────────────────────────────────────────────────────────
  # Ingestion Worker
  # ─────────────────────────────────────────────────────────────────────────
  worker:
    build:
      context: .
      dockerfile: docker/Dockerfile.worker
    container_name: code-graph-worker
    environment:
      - NEO4J_URI=bolt://neo4j:7687
      - NEO4J_USER=neo4j
      - NEO4J_PASSWORD=code-graph-secret
      - KAFKA_BOOTSTRAP_SERVERS=kafka:9092
    depends_on:
      - api
      - kafka
    volumes:
      - /var/run/docker.sock:/var/run/docker.sock  # For cloning repos

volumes:
  neo4j_data:
  neo4j_logs:
  redis_data:
  qdrant_data:
  kafka_data:
```

---

## 🚀 Quick Implementation Mode (MVP)

> **Goal**: Get a working prototype in 1-2 weeks with minimal infrastructure

### Simplified Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                     QUICK IMPLEMENTATION MODE                                │
│                     (Minimal Infrastructure)                                 │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│                         ┌─────────────────┐                                 │
│                         │   Git Repos     │                                 │
│                         └────────┬────────┘                                 │
│                                  │                                          │
│                         ┌────────▼────────┐                                 │
│                         │   Python CLI    │                                 │
│                         │  (Synchronous)  │                                 │
│                         └────────┬────────┘                                 │
│                                  │                                          │
│                         ┌────────▼────────┐                                 │
│                         │     Neo4j       │                                 │
│                         │  (Single Node)  │                                 │
│                         └────────┬────────┘                                 │
│                                  │                                          │
│                         ┌────────▼────────┐                                 │
│                         │   FastAPI       │                                 │
│                         │  (REST Only)    │                                 │
│                         └─────────────────┘                                 │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Minimal Tech Stack

| Component | Technology | Notes |
|-----------|------------|-------|
| **Graph DB** | Neo4j Community | Single instance, no cluster |
| **API** | FastAPI | REST only, no GraphQL initially |
| **Parsing** | Python `ast` + Tree-sitter | Start with Python/JS only |
| **Git** | GitPython | Synchronous processing |
| **Cache** | LRU Cache (in-memory) | Python `functools.lru_cache` |
| **Background Jobs** | None | Synchronous processing |

### Quick Start Docker Compose

```yaml
# docker-compose.quick.yml
version: '3.8'

services:
  neo4j:
    image: neo4j:5.15-community
    container_name: code-graph-neo4j
    ports:
      - "7474:7474"
      - "7687:7687"
    environment:
      - NEO4J_AUTH=neo4j/quickstart
      - NEO4J_PLUGINS=["apoc"]
    volumes:
      - neo4j_data:/data

  api:
    build: .
    container_name: code-graph-api
    ports:
      - "8000:8000"
    environment:
      - NEO4J_URI=bolt://neo4j:7687
      - NEO4J_USER=neo4j
      - NEO4J_PASSWORD=quickstart
      - MODE=quick
    depends_on:
      - neo4j

volumes:
  neo4j_data:
```

### Simplified Project Structure

```
code-graph-quick/
├── 📂 src/
│   ├── __init__.py
│   ├── main.py                    # FastAPI app
│   ├── config.py                  # Simple config
│   ├── 📂 db/
│   │   ├── __init__.py
│   │   └── neo4j_client.py        # Neo4j connection
│   ├── 📂 parsers/
│   │   ├── __init__.py
│   │   ├── python_parser.py       # Python AST parser
│   │   └── git_parser.py          # Git history parser
│   ├── 📂 services/
│   │   ├── __init__.py
│   │   ├── ingestion.py           # Sync ingestion
│   │   ├── coupling.py            # Coupling calculation
│   │   └── query.py               # Query service
│   └── 📂 api/
│       ├── __init__.py
│       └── routes.py              # REST endpoints
├── cli.py                         # CLI tool
├── requirements.txt
├── docker-compose.quick.yml
└── README.md
```

### Minimal Requirements

```txt
# requirements-quick.txt
fastapi==0.109.0
uvicorn==0.27.0
neo4j==5.16.0
gitpython==3.1.41
pydantic==2.5.3
pydantic-settings==2.1.0
typer==0.9.0
tree-sitter==0.20.4
tree-sitter-python==0.20.0
```

### Quick Implementation Code

```python
# ═══════════════════════════════════════════════════════════════════════════
# QUICK MODE: SIMPLIFIED IMPLEMENTATION
# ═══════════════════════════════════════════════════════════════════════════

# ─────────────────────────────────────────────────────────────────────────────
# config.py - Simple configuration
# ─────────────────────────────────────────────────────────────────────────────

from pydantic_settings import BaseSettings

class Settings(BaseSettings):
    neo4j_uri: str = "bolt://localhost:7687"
    neo4j_user: str = "neo4j"
    neo4j_password: str = "quickstart"
    
    class Config:
        env_file = ".env"

settings = Settings()


# ─────────────────────────────────────────────────────────────────────────────
# db/neo4j_client.py - Simple Neo4j client
# ─────────────────────────────────────────────────────────────────────────────

from neo4j import GraphDatabase
from functools import lru_cache
from typing import List, Dict, Any

class Neo4jClient:
    def __init__(self, uri: str, user: str, password: str):
        self.driver = GraphDatabase.driver(uri, auth=(user, password))
    
    def close(self):
        self.driver.close()
    
    def execute(self, query: str, **params) -> List[Dict[str, Any]]:
        with self.driver.session() as session:
            result = session.run(query, **params)
            return [dict(record) for record in result]
    
    # In-memory cache for frequently accessed queries
    @lru_cache(maxsize=1000)
    def get_entity_cached(self, entity_id: str) -> Dict[str, Any]:
        result = self.execute("""
            MATCH (e:Entity {id: $id})
            RETURN e
        """, id=entity_id)
        return result[0] if result else None


# ─────────────────────────────────────────────────────────────────────────────
# services/ingestion.py - Synchronous ingestion
# ─────────────────────────────────────────────────────────────────────────────

import ast
import git
from pathlib import Path
from typing import List, Tuple
from collections import defaultdict

class SimpleIngestionService:
    """
    Synchronous ingestion service for quick implementation.
    No Kafka, no async - just direct database writes.
    """
    
    def __init__(self, db: Neo4jClient):
        self.db = db
    
    def ingest_repository(self, repo_path: str) -> dict:
        """
        Ingest a repository synchronously.
        
        Steps:
        1. Parse all Python files
        2. Extract git history
        3. Build graph in Neo4j
        4. Calculate coupling (in-line)
        """
        
        stats = {"files": 0, "commits": 0, "entities": 0, "couplings": 0}
        
        # Step 1: Parse source files
        repo = git.Repo(repo_path)
        python_files = list(Path(repo_path).rglob("*.py"))
        
        for file_path in python_files:
            if ".git" in str(file_path):
                continue
            try:
                entities = self._parse_python_file(str(file_path), repo_path)
                for entity in entities:
                    self._create_entity(entity)
                    stats["entities"] += 1
                stats["files"] += 1
            except Exception as e:
                print(f"Error parsing {file_path}: {e}")
        
        # Step 2: Extract git history
        for commit in repo.iter_commits(max_count=1000):
            self._create_commit(commit, repo_path)
            stats["commits"] += 1
        
        # Step 3: Calculate coupling (synchronous)
        stats["couplings"] = self._calculate_coupling_sync()
        
        return stats
    
    def _parse_python_file(self, file_path: str, repo_path: str) -> List[dict]:
        """Parse a Python file and extract entities."""
        
        with open(file_path, 'r', encoding='utf-8', errors='ignore') as f:
            source = f.read()
        
        tree = ast.parse(source)
        relative_path = str(Path(file_path).relative_to(repo_path))
        entities = []
        
        for node in ast.walk(tree):
            if isinstance(node, ast.ClassDef):
                entities.append({
                    "type": "CLASS",
                    "name": node.name,
                    "qualified_name": f"{relative_path}:{node.name}",
                    "file_path": relative_path,
                    "line_start": node.lineno,
                    "line_end": node.end_lineno,
                })
                
                # Extract methods
                for item in node.body:
                    if isinstance(item, ast.FunctionDef):
                        entities.append({
                            "type": "METHOD",
                            "name": item.name,
                            "qualified_name": f"{relative_path}:{node.name}.{item.name}",
                            "file_path": relative_path,
                            "line_start": item.lineno,
                            "line_end": item.end_lineno,
                            "parent_class": node.name,
                        })
            
            elif isinstance(node, ast.FunctionDef):
                # Top-level function
                if not any(isinstance(p, ast.ClassDef) for p in ast.walk(tree)):
                    entities.append({
                        "type": "FUNCTION",
                        "name": node.name,
                        "qualified_name": f"{relative_path}:{node.name}",
                        "file_path": relative_path,
                        "line_start": node.lineno,
                        "line_end": node.end_lineno,
                    })
        
        return entities
    
    def _create_entity(self, entity: dict) -> None:
        """Create entity node in Neo4j."""
        
        self.db.execute("""
            MERGE (e:Entity {qualified_name: $qualified_name})
            SET e.type = $type,
                e.name = $name,
                e.file_path = $file_path,
                e.line_start = $line_start,
                e.line_end = $line_end
        """, **entity)
        
        # Create CONTAINS relationship if it's a method
        if entity.get("parent_class"):
            self.db.execute("""
                MATCH (c:Entity {name: $parent, type: 'CLASS', file_path: $file})
                MATCH (m:Entity {qualified_name: $method_qn})
                MERGE (c)-[:CONTAINS]->(m)
            """, parent=entity["parent_class"], 
                 file=entity["file_path"],
                 method_qn=entity["qualified_name"])
    
    def _create_commit(self, commit, repo_path: str) -> None:
        """Create commit node and MODIFIED relationships."""
        
        # Create commit node
        self.db.execute("""
            MERGE (c:Commit {sha: $sha})
            SET c.message = $message,
                c.timestamp = $timestamp,
                c.author_name = $author_name,
                c.author_email = $author_email
        """, sha=commit.hexsha,
             message=commit.message[:500],  # Truncate long messages
             timestamp=commit.committed_datetime.isoformat(),
             author_name=commit.author.name,
             author_email=commit.author.email)
        
        # Create MODIFIED relationships for changed files
        if commit.parents:
            diff = commit.parents[0].diff(commit)
            for change in diff:
                file_path = change.b_path or change.a_path
                if file_path.endswith('.py'):
                    self.db.execute("""
                        MATCH (c:Commit {sha: $sha})
                        MERGE (f:File {path: $path})
                        MERGE (c)-[m:MODIFIED]->(f)
                        SET m.change_type = $change_type
                    """, sha=commit.hexsha, 
                         path=file_path,
                         change_type=change.change_type)
    
    def _calculate_coupling_sync(self) -> int:
        """
        Calculate temporal coupling synchronously using Cypher.
        Returns number of coupling relationships created.
        """
        
        result = self.db.execute("""
            // Find files changed together
            MATCH (c:Commit)-[:MODIFIED]->(f1:File)
            MATCH (c)-[:MODIFIED]->(f2:File)
            WHERE id(f1) < id(f2)
            
            WITH f1, f2, count(c) as co_changes
            WHERE co_changes >= 3
            
            // Calculate coupling score
            MATCH (c1:Commit)-[:MODIFIED]->(f1)
            WITH f1, f2, co_changes, count(c1) as f1_changes
            
            MATCH (c2:Commit)-[:MODIFIED]->(f2)
            WITH f1, f2, co_changes, f1_changes, count(c2) as f2_changes
            
            WITH f1, f2, co_changes,
                 toFloat(2 * co_changes) / (f1_changes + f2_changes) as coupling
            
            WHERE coupling >= 0.3
            
            MERGE (f1)-[r:COUPLED_WITH]-(f2)
            SET r.score = coupling,
                r.co_changes = co_changes,
                r.computed_at = datetime()
            
            RETURN count(r) as created
        """)
        
        return result[0]['created'] if result else 0


# ─────────────────────────────────────────────────────────────────────────────
# api/routes.py - Simple REST API
# ─────────────────────────────────────────────────────────────────────────────

from fastapi import FastAPI, HTTPException, BackgroundTasks
from pydantic import BaseModel
from typing import Optional, List

app = FastAPI(title="Code Graph API (Quick Mode)", version="0.1.0")

# Global DB client (simple for MVP)
db = None

@app.on_event("startup")
def startup():
    global db
    from config import settings
    from db.neo4j_client import Neo4jClient
    db = Neo4jClient(settings.neo4j_uri, settings.neo4j_user, settings.neo4j_password)

@app.on_event("shutdown")
def shutdown():
    if db:
        db.close()


class IngestRequest(BaseModel):
    repo_path: str


class EntityResponse(BaseModel):
    qualified_name: str
    name: str
    type: str
    file_path: str


@app.post("/api/v1/ingest")
def ingest_repository(request: IngestRequest):
    """Ingest a repository (synchronous for MVP)."""
    from services.ingestion import SimpleIngestionService
    service = SimpleIngestionService(db)
    stats = service.ingest_repository(request.repo_path)
    return {"status": "completed", "stats": stats}


@app.get("/api/v1/entities/{entity_name}")
def get_entity(entity_name: str):
    """Get entity by qualified name."""
    result = db.execute("""
        MATCH (e:Entity)
        WHERE e.qualified_name CONTAINS $name OR e.name = $name
        RETURN e.qualified_name as qualified_name,
               e.name as name,
               e.type as type,
               e.file_path as file_path
        LIMIT 10
    """, name=entity_name)
    
    if not result:
        raise HTTPException(status_code=404, detail="Entity not found")
    return result


@app.get("/api/v1/entities/{entity_name}/coupling")
def get_coupling(entity_name: str, min_score: float = 0.3):
    """Get coupling relationships for an entity."""
    result = db.execute("""
        MATCH (e:Entity)-[:CONTAINS*0..1]->(f:File)
        WHERE e.qualified_name CONTAINS $name OR e.name = $name
        MATCH (f)-[r:COUPLED_WITH]-(other:File)
        WHERE r.score >= $min_score
        RETURN other.path as file,
               r.score as coupling_score,
               r.co_changes as co_changes
        ORDER BY r.score DESC
        LIMIT 20
    """, name=entity_name, min_score=min_score)
    
    return {"entity": entity_name, "coupled_with": result}


@app.get("/api/v1/entities/{entity_name}/history")
def get_history(entity_name: str, limit: int = 20):
    """Get change history for an entity."""
    result = db.execute("""
        MATCH (e:Entity)
        WHERE e.qualified_name CONTAINS $name OR e.name = $name
        MATCH (c:Commit)-[:MODIFIED]->(f:File {path: e.file_path})
        RETURN c.sha as sha,
               c.message as message,
               c.timestamp as timestamp,
               c.author_name as author
        ORDER BY c.timestamp DESC
        LIMIT $limit
    """, name=entity_name, limit=limit)
    
    return {"entity": entity_name, "commits": result}


@app.get("/api/v1/hotspots")
def get_hotspots(min_changes: int = 10):
    """Get code hotspots (files with high change frequency)."""
    result = db.execute("""
        MATCH (c:Commit)-[:MODIFIED]->(f:File)
        WITH f, count(c) as change_count
        WHERE change_count >= $min_changes
        
        OPTIONAL MATCH (f)-[r:COUPLED_WITH]-(other)
        WITH f, change_count, count(r) as coupling_count
        
        RETURN f.path as file,
               change_count as changes,
               coupling_count as couplings,
               change_count * 0.6 + coupling_count * 0.4 as hotspot_score
        ORDER BY hotspot_score DESC
        LIMIT 20
    """, min_changes=min_changes)
    
    return {"hotspots": result}


# ─────────────────────────────────────────────────────────────────────────────
# cli.py - Simple CLI tool
# ─────────────────────────────────────────────────────────────────────────────

import typer
from pathlib import Path

cli = typer.Typer(help="Code Graph CLI (Quick Mode)")

@cli.command()
def ingest(repo_path: str = typer.Argument(..., help="Path to git repository")):
    """Ingest a repository into the graph."""
    from config import settings
    from db.neo4j_client import Neo4jClient
    from services.ingestion import SimpleIngestionService
    
    if not Path(repo_path).exists():
        typer.echo(f"Error: Path {repo_path} does not exist")
        raise typer.Exit(1)
    
    typer.echo(f"Connecting to Neo4j at {settings.neo4j_uri}...")
    db = Neo4jClient(settings.neo4j_uri, settings.neo4j_user, settings.neo4j_password)
    
    typer.echo(f"Ingesting repository: {repo_path}")
    service = SimpleIngestionService(db)
    stats = service.ingest_repository(repo_path)
    
    typer.echo(f"\n✅ Ingestion complete!")
    typer.echo(f"   Files processed: {stats['files']}")
    typer.echo(f"   Entities created: {stats['entities']}")
    typer.echo(f"   Commits indexed: {stats['commits']}")
    typer.echo(f"   Couplings found: {stats['couplings']}")
    
    db.close()


@cli.command()
def coupling(entity: str = typer.Argument(..., help="Entity name to analyze")):
    """Show coupling relationships for an entity."""
    from config import settings
    from db.neo4j_client import Neo4jClient
    
    db = Neo4jClient(settings.neo4j_uri, settings.neo4j_user, settings.neo4j_password)
    
    result = db.execute("""
        MATCH (e:Entity)
        WHERE e.qualified_name CONTAINS $name OR e.name = $name
        MATCH (f:File {path: e.file_path})-[r:COUPLED_WITH]-(other:File)
        RETURN other.path as file, r.score as score
        ORDER BY r.score DESC
        LIMIT 10
    """, name=entity)
    
    if not result:
        typer.echo(f"No coupling found for: {entity}")
    else:
        typer.echo(f"\n🔗 Coupling for: {entity}\n")
        for r in result:
            bar = "█" * int(r['score'] * 20)
            typer.echo(f"  {r['score']:.2f} {bar} {r['file']}")
    
    db.close()


@cli.command()
def hotspots():
    """Show code hotspots."""
    from config import settings
    from db.neo4j_client import Neo4jClient
    
    db = Neo4jClient(settings.neo4j_uri, settings.neo4j_user, settings.neo4j_password)
    
    result = db.execute("""
        MATCH (c:Commit)-[:MODIFIED]->(f:File)
        WITH f, count(c) as changes
        WHERE changes >= 5
        RETURN f.path as file, changes
        ORDER BY changes DESC
        LIMIT 15
    """)
    
    typer.echo("\n🔥 Code Hotspots (by change frequency)\n")
    for r in result:
        bar = "█" * min(int(r['changes'] / 2), 30)
        typer.echo(f"  {r['changes']:3d} {bar} {r['file']}")
    
    db.close()


if __name__ == "__main__":
    cli()
```

### Quick Implementation Timeline

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                    QUICK IMPLEMENTATION TIMELINE                             │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  Day 1-2: Setup                                                             │
│  ─────────────────                                                          │
│  ✓ Docker compose with Neo4j                                                │
│  ✓ FastAPI project skeleton                                                 │
│  ✓ Neo4j client with basic operations                                       │
│                                                                             │
│  Day 3-4: Parsing                                                           │
│  ─────────────────                                                          │
│  ✓ Python AST parser (classes, methods, functions)                          │
│  ✓ GitPython integration for history                                        │
│  ✓ Basic entity and commit ingestion                                        │
│                                                                             │
│  Day 5-6: Analysis                                                          │
│  ─────────────────                                                          │
│  ✓ Temporal coupling calculation (Cypher)                                   │
│  ✓ Hotspot detection query                                                  │
│  ✓ Basic dependency tracking                                                │
│                                                                             │
│  Day 7-8: API                                                               │
│  ─────────────────                                                          │
│  ✓ REST endpoints for entities, coupling, history                           │
│  ✓ CLI tool for ingestion and queries                                       │
│  ✓ Basic error handling                                                     │
│                                                                             │
│  Day 9-10: Polish                                                           │
│  ─────────────────                                                          │
│  ✓ Documentation                                                            │
│  ✓ Basic tests                                                              │
│  ✓ README and setup instructions                                            │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 🏭 Production Mode (Full Infrastructure)

> **Goal**: Scalable, resilient system for large codebases and teams

### Production Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                        PRODUCTION MODE                                       │
│                    (Full Infrastructure)                                     │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│   ┌───────────────────────────────────────────────────────────────────────┐ │
│   │                        KUBERNETES CLUSTER                             │ │
│   ├───────────────────────────────────────────────────────────────────────┤ │
│   │                                                                       │ │
│   │  ┌─────────────┐        ┌─────────────┐        ┌─────────────┐       │ │
│   │  │  Ingress    │        │  API GW     │        │ Auth (OIDC) │       │ │
│   │  │  (Nginx)    │───────▶│  (Kong)     │───────▶│  (Keycloak) │       │ │
│   │  └─────────────┘        └──────┬──────┘        └─────────────┘       │ │
│   │                                │                                      │ │
│   │           ┌────────────────────┼────────────────────┐                 │ │
│   │           ▼                    ▼                    ▼                 │ │
│   │  ┌─────────────┐      ┌─────────────┐      ┌─────────────┐           │ │
│   │  │ Query Svc   │      │ Ingest Svc  │      │ Analysis    │           │ │
│   │  │ (3 replicas)│      │ (2 replicas)│      │ Workers (5) │           │ │
│   │  └──────┬──────┘      └──────┬──────┘      └──────┬──────┘           │ │
│   │         │                    │                    │                   │ │
│   │         │           ┌────────▼────────┐          │                   │ │
│   │         │           │     Kafka       │◀─────────┘                   │ │
│   │         │           │   (3 brokers)   │                              │ │
│   │         │           └────────┬────────┘                              │ │
│   │         │                    │                                        │ │
│   │    ┌────▼────────────────────▼────────────────────┐                  │ │
│   │    │                                              │                  │ │
│   │    │  ┌────────┐  ┌────────┐  ┌────────┐  ┌────────┐                │ │
│   │    │  │ Neo4j  │  │ Redis  │  │ Qdrant │  │Elastic │                │ │
│   │    │  │Cluster │  │Sentinel│  │Cluster │  │Search  │                │ │
│   │    │  │(3 core)│  │(3 node)│  │(3 node)│  │(3 node)│                │ │
│   │    │  └────────┘  └────────┘  └────────┘  └────────┘                │ │
│   │    │                   DATA LAYER                                    │ │
│   │    └─────────────────────────────────────────────────────────────────┘ │
│   │                                                                       │ │
│   │  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐                   │ │
│   │  │ Prometheus  │  │   Grafana   │  │   Jaeger    │                   │ │
│   │  │  (Metrics)  │  │ (Dashboards)│  │  (Tracing)  │                   │ │
│   │  └─────────────┘  └─────────────┘  └─────────────┘                   │ │
│   │                      OBSERVABILITY                                    │ │
│   └───────────────────────────────────────────────────────────────────────┘ │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Full Technology Stack

| Layer | Technology | Configuration | Purpose |
|-------|------------|---------------|---------|
| **API Gateway** | Kong | HA cluster | Rate limiting, auth, routing |
| **Authentication** | Keycloak | HA with PostgreSQL | OAuth2/OIDC |
| **Graph Database** | Neo4j Enterprise | 3-node cluster | Code graph storage |
| **Cache** | Redis Sentinel | 3 nodes + sentinels | Query caching, sessions |
| **Vector Store** | Qdrant | 3-node cluster | Code embeddings |
| **Search** | Elasticsearch | 3-node cluster | Full-text code search |
| **Message Queue** | Apache Kafka | 3 brokers + ZK | Event streaming |
| **Orchestration** | Apache Airflow | HA with Celery | Pipeline scheduling |
| **Metrics** | Prometheus + Grafana | HA setup | Monitoring |
| **Tracing** | Jaeger | Collector + Query | Distributed tracing |
| **Logging** | Loki + Promtail | Scalable | Centralized logs |

### Production Docker Compose

```yaml
# docker-compose.production.yml
version: '3.8'

services:
  # ═══════════════════════════════════════════════════════════════════════════
  # API GATEWAY
  # ═══════════════════════════════════════════════════════════════════════════
  
  kong:
    image: kong:3.5
    container_name: code-graph-kong
    environment:
      KONG_DATABASE: "off"
      KONG_PROXY_ACCESS_LOG: /dev/stdout
      KONG_ADMIN_ACCESS_LOG: /dev/stdout
      KONG_PROXY_ERROR_LOG: /dev/stderr
      KONG_ADMIN_ERROR_LOG: /dev/stderr
      KONG_ADMIN_LISTEN: 0.0.0.0:8001
    ports:
      - "8000:8000"
      - "8001:8001"
    volumes:
      - ./kong/kong.yml:/etc/kong/kong.yml:ro
    healthcheck:
      test: ["CMD", "kong", "health"]
      interval: 10s
      timeout: 5s
      retries: 5

  # ═══════════════════════════════════════════════════════════════════════════
  # NEO4J CLUSTER
  # ═══════════════════════════════════════════════════════════════════════════

  neo4j-core1:
    image: neo4j:5.15-enterprise
    container_name: code-graph-neo4j-core1
    environment:
      - NEO4J_AUTH=neo4j/${NEO4J_PASSWORD}
      - NEO4J_ACCEPT_LICENSE_AGREEMENT=yes
      - NEO4J_EDITION=enterprise
      - NEO4J_initial_server_mode__constraint=PRIMARY
      - NEO4J_dbms_cluster_discovery_endpoints=neo4j-core1:5000,neo4j-core2:5000,neo4j-core3:5000
      - NEO4J_PLUGINS=["apoc", "graph-data-science"]
      - NEO4J_dbms_memory_heap_max__size=8G
      - NEO4J_dbms_memory_pagecache_size=4G
    volumes:
      - neo4j_core1_data:/data
      - neo4j_core1_logs:/logs
    networks:
      - code-graph-network

  neo4j-core2:
    image: neo4j:5.15-enterprise
    container_name: code-graph-neo4j-core2
    environment:
      - NEO4J_AUTH=neo4j/${NEO4J_PASSWORD}
      - NEO4J_ACCEPT_LICENSE_AGREEMENT=yes
      - NEO4J_EDITION=enterprise
      - NEO4J_initial_server_mode__constraint=PRIMARY
      - NEO4J_dbms_cluster_discovery_endpoints=neo4j-core1:5000,neo4j-core2:5000,neo4j-core3:5000
      - NEO4J_PLUGINS=["apoc", "graph-data-science"]
    volumes:
      - neo4j_core2_data:/data
    networks:
      - code-graph-network

  neo4j-core3:
    image: neo4j:5.15-enterprise
    container_name: code-graph-neo4j-core3
    environment:
      - NEO4J_AUTH=neo4j/${NEO4J_PASSWORD}
      - NEO4J_ACCEPT_LICENSE_AGREEMENT=yes
      - NEO4J_EDITION=enterprise
      - NEO4J_initial_server_mode__constraint=PRIMARY
      - NEO4J_dbms_cluster_discovery_endpoints=neo4j-core1:5000,neo4j-core2:5000,neo4j-core3:5000
      - NEO4J_PLUGINS=["apoc", "graph-data-science"]
    volumes:
      - neo4j_core3_data:/data
    networks:
      - code-graph-network

  # ═══════════════════════════════════════════════════════════════════════════
  # REDIS SENTINEL
  # ═══════════════════════════════════════════════════════════════════════════

  redis-master:
    image: redis:7-alpine
    container_name: code-graph-redis-master
    command: redis-server --appendonly yes --requirepass ${REDIS_PASSWORD}
    volumes:
      - redis_master_data:/data
    networks:
      - code-graph-network

  redis-replica:
    image: redis:7-alpine
    container_name: code-graph-redis-replica
    command: redis-server --replicaof redis-master 6379 --requirepass ${REDIS_PASSWORD} --masterauth ${REDIS_PASSWORD}
    depends_on:
      - redis-master
    networks:
      - code-graph-network

  redis-sentinel:
    image: redis:7-alpine
    container_name: code-graph-redis-sentinel
    command: redis-sentinel /etc/redis/sentinel.conf
    volumes:
      - ./redis/sentinel.conf:/etc/redis/sentinel.conf
    depends_on:
      - redis-master
      - redis-replica
    networks:
      - code-graph-network

  # ═══════════════════════════════════════════════════════════════════════════
  # QDRANT VECTOR DATABASE
  # ═══════════════════════════════════════════════════════════════════════════

  qdrant:
    image: qdrant/qdrant:v1.7.0
    container_name: code-graph-qdrant
    ports:
      - "6333:6333"
      - "6334:6334"
    environment:
      - QDRANT__SERVICE__GRPC_PORT=6334
    volumes:
      - qdrant_data:/qdrant/storage
    networks:
      - code-graph-network

  # ═══════════════════════════════════════════════════════════════════════════
  # KAFKA CLUSTER
  # ═══════════════════════════════════════════════════════════════════════════

  zookeeper:
    image: confluentinc/cp-zookeeper:7.5.0
    container_name: code-graph-zookeeper
    environment:
      ZOOKEEPER_CLIENT_PORT: 2181
      ZOOKEEPER_TICK_TIME: 2000
    volumes:
      - zookeeper_data:/var/lib/zookeeper/data
    networks:
      - code-graph-network

  kafka-1:
    image: confluentinc/cp-kafka:7.5.0
    container_name: code-graph-kafka-1
    depends_on:
      - zookeeper
    environment:
      KAFKA_BROKER_ID: 1
      KAFKA_ZOOKEEPER_CONNECT: zookeeper:2181
      KAFKA_ADVERTISED_LISTENERS: PLAINTEXT://kafka-1:29092,EXTERNAL://localhost:9092
      KAFKA_LISTENER_SECURITY_PROTOCOL_MAP: PLAINTEXT:PLAINTEXT,EXTERNAL:PLAINTEXT
      KAFKA_INTER_BROKER_LISTENER_NAME: PLAINTEXT
      KAFKA_OFFSETS_TOPIC_REPLICATION_FACTOR: 3
    volumes:
      - kafka1_data:/var/lib/kafka/data
    networks:
      - code-graph-network

  kafka-2:
    image: confluentinc/cp-kafka:7.5.0
    container_name: code-graph-kafka-2
    depends_on:
      - zookeeper
    environment:
      KAFKA_BROKER_ID: 2
      KAFKA_ZOOKEEPER_CONNECT: zookeeper:2181
      KAFKA_ADVERTISED_LISTENERS: PLAINTEXT://kafka-2:29092,EXTERNAL://localhost:9093
      KAFKA_LISTENER_SECURITY_PROTOCOL_MAP: PLAINTEXT:PLAINTEXT,EXTERNAL:PLAINTEXT
      KAFKA_INTER_BROKER_LISTENER_NAME: PLAINTEXT
      KAFKA_OFFSETS_TOPIC_REPLICATION_FACTOR: 3
    volumes:
      - kafka2_data:/var/lib/kafka/data
    networks:
      - code-graph-network

  kafka-3:
    image: confluentinc/cp-kafka:7.5.0
    container_name: code-graph-kafka-3
    depends_on:
      - zookeeper
    environment:
      KAFKA_BROKER_ID: 3
      KAFKA_ZOOKEEPER_CONNECT: zookeeper:2181
      KAFKA_ADVERTISED_LISTENERS: PLAINTEXT://kafka-3:29092,EXTERNAL://localhost:9094
      KAFKA_LISTENER_SECURITY_PROTOCOL_MAP: PLAINTEXT:PLAINTEXT,EXTERNAL:PLAINTEXT
      KAFKA_INTER_BROKER_LISTENER_NAME: PLAINTEXT
      KAFKA_OFFSETS_TOPIC_REPLICATION_FACTOR: 3
    volumes:
      - kafka3_data:/var/lib/kafka/data
    networks:
      - code-graph-network

  # ═══════════════════════════════════════════════════════════════════════════
  # ELASTICSEARCH
  # ═══════════════════════════════════════════════════════════════════════════

  elasticsearch:
    image: docker.elastic.co/elasticsearch/elasticsearch:8.11.0
    container_name: code-graph-elasticsearch
    environment:
      - discovery.type=single-node
      - xpack.security.enabled=false
      - "ES_JAVA_OPTS=-Xms2g -Xmx2g"
    volumes:
      - elasticsearch_data:/usr/share/elasticsearch/data
    ports:
      - "9200:9200"
    networks:
      - code-graph-network

  # ═══════════════════════════════════════════════════════════════════════════
  # APPLICATION SERVICES
  # ═══════════════════════════════════════════════════════════════════════════

  api:
    build:
      context: .
      dockerfile: docker/Dockerfile
    container_name: code-graph-api
    environment:
      - MODE=production
      - NEO4J_URI=bolt://neo4j-core1:7687
      - NEO4J_USER=neo4j
      - NEO4J_PASSWORD=${NEO4J_PASSWORD}
      - REDIS_URL=redis://:${REDIS_PASSWORD}@redis-master:6379
      - QDRANT_URL=http://qdrant:6333
      - KAFKA_BOOTSTRAP_SERVERS=kafka-1:29092,kafka-2:29092,kafka-3:29092
      - ELASTICSEARCH_URL=http://elasticsearch:9200
      - OTEL_EXPORTER_OTLP_ENDPOINT=http://jaeger:4317
    deploy:
      replicas: 3
    depends_on:
      - neo4j-core1
      - redis-master
      - kafka-1
    networks:
      - code-graph-network

  ingestion-worker:
    build:
      context: .
      dockerfile: docker/Dockerfile.worker
    container_name: code-graph-worker
    environment:
      - MODE=production
      - NEO4J_URI=bolt://neo4j-core1:7687
      - KAFKA_BOOTSTRAP_SERVERS=kafka-1:29092,kafka-2:29092,kafka-3:29092
      - KAFKA_CONSUMER_GROUP=ingestion-workers
    deploy:
      replicas: 5
    depends_on:
      - kafka-1
      - neo4j-core1
    networks:
      - code-graph-network

  analysis-worker:
    build:
      context: .
      dockerfile: docker/Dockerfile.analysis
    container_name: code-graph-analysis
    environment:
      - MODE=production
      - NEO4J_URI=bolt://neo4j-core1:7687
      - KAFKA_BOOTSTRAP_SERVERS=kafka-1:29092,kafka-2:29092,kafka-3:29092
      - KAFKA_CONSUMER_GROUP=analysis-workers
      - QDRANT_URL=http://qdrant:6333
    deploy:
      replicas: 3
    depends_on:
      - kafka-1
      - neo4j-core1
      - qdrant
    networks:
      - code-graph-network

  # ═══════════════════════════════════════════════════════════════════════════
  # OBSERVABILITY
  # ═══════════════════════════════════════════════════════════════════════════

  prometheus:
    image: prom/prometheus:v2.48.0
    container_name: code-graph-prometheus
    volumes:
      - ./monitoring/prometheus.yml:/etc/prometheus/prometheus.yml
      - prometheus_data:/prometheus
    ports:
      - "9090:9090"
    networks:
      - code-graph-network

  grafana:
    image: grafana/grafana:10.2.2
    container_name: code-graph-grafana
    environment:
      - GF_SECURITY_ADMIN_PASSWORD=${GRAFANA_PASSWORD}
    volumes:
      - grafana_data:/var/lib/grafana
      - ./monitoring/grafana/dashboards:/etc/grafana/provisioning/dashboards
      - ./monitoring/grafana/datasources:/etc/grafana/provisioning/datasources
    ports:
      - "3000:3000"
    depends_on:
      - prometheus
    networks:
      - code-graph-network

  jaeger:
    image: jaegertracing/all-in-one:1.52
    container_name: code-graph-jaeger
    environment:
      - COLLECTOR_OTLP_ENABLED=true
    ports:
      - "16686:16686"
      - "4317:4317"
    networks:
      - code-graph-network

networks:
  code-graph-network:
    driver: bridge

volumes:
  neo4j_core1_data:
  neo4j_core1_logs:
  neo4j_core2_data:
  neo4j_core3_data:
  redis_master_data:
  qdrant_data:
  zookeeper_data:
  kafka1_data:
  kafka2_data:
  kafka3_data:
  elasticsearch_data:
  prometheus_data:
  grafana_data:
```

### Production Requirements

```txt
# requirements-production.txt

# Core
fastapi==0.109.0
uvicorn[standard]==0.27.0
gunicorn==21.2.0

# GraphQL
strawberry-graphql[fastapi]==0.217.0

# Database clients
neo4j==5.16.0
redis[hiredis]==5.0.1
qdrant-client==1.7.0
elasticsearch==8.11.0

# Kafka
aiokafka==0.10.0
confluent-kafka==2.3.0

# Git & Parsing
gitpython==3.1.41
tree-sitter==0.20.4
tree-sitter-python==0.20.0
tree-sitter-java==0.20.0
tree-sitter-javascript==0.20.0
tree-sitter-typescript==0.20.0

# ML/Embeddings
transformers==4.36.2
torch==2.1.2
sentence-transformers==2.2.2

# Observability
opentelemetry-api==1.22.0
opentelemetry-sdk==1.22.0
opentelemetry-exporter-otlp==1.22.0
opentelemetry-instrumentation-fastapi==0.43b0
prometheus-fastapi-instrumentator==6.1.0

# Utilities
pydantic==2.5.3
pydantic-settings==2.1.0
python-jose[cryptography]==3.3.0
httpx==0.26.0
tenacity==8.2.3
structlog==24.1.0

# Testing
pytest==7.4.4
pytest-asyncio==0.23.3
pytest-cov==4.1.0
httpx==0.26.0
```

### Production Comparison Table

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                    QUICK vs PRODUCTION COMPARISON                            │
├──────────────────┬──────────────────────────┬───────────────────────────────┤
│  Feature         │  Quick Mode              │  Production Mode              │
├──────────────────┼──────────────────────────┼───────────────────────────────┤
│  Setup Time      │  1-2 hours               │  1-2 days                     │
│  Implementation  │  1-2 weeks               │  10-14 weeks                  │
│  Team Size       │  1 developer             │  3-5 developers               │
│                  │                          │                               │
│  Neo4j           │  Single Community        │  3-node Enterprise cluster    │
│  Cache           │  In-memory LRU           │  Redis Sentinel (3 nodes)     │
│  Queue           │  None (sync)             │  Kafka (3 brokers)            │
│  Search          │  Neo4j fulltext          │  Elasticsearch cluster        │
│  Vectors         │  None                    │  Qdrant cluster               │
│                  │                          │                               │
│  API             │  REST only               │  REST + GraphQL + WebSocket   │
│  Auth            │  None / Basic            │  OAuth2 (Keycloak)            │
│  Rate Limiting   │  None                    │  Kong API Gateway             │
│                  │                          │                               │
│  Monitoring      │  Console logs            │  Prometheus + Grafana         │
│  Tracing         │  None                    │  Jaeger / OpenTelemetry       │
│  Logging         │  File logs               │  Loki + Promtail              │
│                  │                          │                               │
│  Max Repos       │  ~10                     │  Unlimited                    │
│  Max Entities    │  ~100K                   │  10M+                         │
│  Max Users       │  ~5                      │  1000+                        │
│  Ingestion       │  Synchronous             │  Async (workers)              │
│                  │                          │                               │
│  Cost/Month      │  ~$50 (single server)    │  ~$2000+ (cloud infra)        │
│  SLA             │  None                    │  99.9% uptime                 │
│                  │                          │                               │
│  Best For        │  POC, small teams        │  Enterprise, large codebases  │
│                  │  Learning, prototyping   │  Multiple teams, production   │
└──────────────────┴──────────────────────────┴───────────────────────────────┘
```

### Migration Path: Quick → Production

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                    MIGRATION PATH: QUICK → PRODUCTION                        │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  Step 1: Add Redis Cache                                                    │
│  ────────────────────────                                                   │
│  • Replace LRU cache with Redis                                             │
│  • Add caching decorator for queries                                        │
│  • Minimal code changes                                                     │
│                                                                             │
│  Step 2: Add Async Processing                                               │
│  ────────────────────────────                                               │
│  • Add Kafka for job queue                                                  │
│  • Convert ingestion to async workers                                       │
│  • Keep sync API, async background                                          │
│                                                                             │
│  Step 3: Add Search                                                         │
│  ────────────────────                                                       │
│  • Add Elasticsearch for full-text                                          │
│  • Dual-write to Neo4j + ES                                                 │
│  • Hybrid queries                                                           │
│                                                                             │
│  Step 4: Scale Neo4j                                                        │
│  ────────────────────                                                       │
│  • Migrate to Enterprise                                                    │
│  • Add read replicas                                                        │
│  • Implement causal clustering                                              │
│                                                                             │
│  Step 5: Add Vector Search                                                  │
│  ────────────────────────                                                   │
│  • Add Qdrant for embeddings                                                │
│  • Generate code embeddings                                                 │
│  • Enable semantic search                                                   │
│                                                                             │
│  Step 6: Add Observability                                                  │
│  ─────────────────────────                                                  │
│  • Add Prometheus metrics                                                   │
│  • Add distributed tracing                                                  │
│  • Create Grafana dashboards                                                │
│                                                                             │
│  Step 7: Harden Security                                                    │
│  ────────────────────────                                                   │
│  • Add API Gateway (Kong)                                                   │
│  • Implement OAuth2 (Keycloak)                                              │
│  • Add rate limiting                                                        │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## ✅ Implementation Checklist

### Quick Mode Checklist (1-2 Weeks)

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                    QUICK MODE IMPLEMENTATION CHECKLIST                       │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  DAY 1-2: Setup                                                             │
│  ──────────────────                                                         │
│  □ Docker compose with Neo4j Community                                      │
│  □ FastAPI project skeleton                                                 │
│  □ Neo4j client with connection handling                                    │
│  □ Basic Pydantic models                                                    │
│                                                                             │
│  DAY 3-4: Parsing                                                           │
│  ──────────────────                                                         │
│  □ Python AST parser (classes, methods, functions)                          │
│  □ GitPython integration                                                    │
│  □ Commit and file change extraction                                        │
│  □ Entity node creation                                                     │
│                                                                             │
│  DAY 5-6: Analysis                                                          │
│  ──────────────────                                                         │
│  □ Temporal coupling Cypher query                                           │
│  □ Hotspot detection query                                                  │
│  □ Basic history queries                                                    │
│                                                                             │
│  DAY 7-8: API                                                               │
│  ──────────────────                                                         │
│  □ REST endpoints (entities, coupling, history)                             │
│  □ Ingest endpoint                                                          │
│  □ CLI tool with Typer                                                      │
│                                                                             │
│  DAY 9-10: Polish                                                           │
│  ──────────────────                                                         │
│  □ Error handling                                                           │
│  □ Basic tests                                                              │
│  □ README and documentation                                                 │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Production Mode Checklist (10-14 Weeks)

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                  PRODUCTION MODE IMPLEMENTATION CHECKLIST                    │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  PHASE 1: Core Infrastructure (Weeks 1-3)                                   │
│  ─────────────────────────────────────────                                  │
│  □ Neo4j Enterprise cluster (3 nodes)                                       │
│  □ Redis Sentinel setup (3 nodes)                                           │
│  □ Qdrant cluster for embeddings                                            │
│  □ Kafka cluster (3 brokers + ZooKeeper)                                    │
│  □ Elasticsearch for full-text search                                       │
│  □ FastAPI with async support                                               │
│  □ Configuration management (pydantic-settings)                             │
│  □ OpenTelemetry instrumentation                                            │
│                                                                             │
│  PHASE 2: Data Ingestion (Weeks 4-7)                                        │
│  ─────────────────────────────────────                                      │
│  □ Git adapter with async extraction                                        │
│  □ Tree-sitter multi-language parser                                        │
│  □ Python AST parser with call graph                                        │
│  □ Java parser (tree-sitter)                                                │
│  □ TypeScript/JavaScript parser                                             │
│  □ Dependency resolvers (npm, pip, maven)                                   │
│  □ Kafka-based async ingestion pipeline                                     │
│  □ Incremental sync with change detection                                   │
│  □ Batch ingestion for large repos                                          │
│                                                                             │
│  PHASE 3: Analysis & Algorithms (Weeks 8-10)                                │
│  ───────────────────────────────────────────                                │
│  □ Temporal coupling calculation                                            │
│  □ Structural coupling analysis                                             │
│  □ Combined coupling score                                                  │
│  □ Hotspot detection with configurable weights                              │
│  □ Impact analysis with BFS/DFS traversal                                   │
│  □ Circular dependency detection                                            │
│  □ Code embedding generation (CodeBERT/StarCoder)                           │
│  □ Semantic similarity search via Qdrant                                    │
│  □ Community detection (Louvain/Label Propagation)                          │
│  □ Centrality metrics (PageRank, Betweenness)                               │
│                                                                             │
│  PHASE 4: API & Clients (Weeks 11-12)                                       │
│  ─────────────────────────────────────                                      │
│  □ GraphQL schema with Strawberry                                           │
│  □ REST API endpoints                                                       │
│  □ WebSocket subscriptions                                                  │
│  □ CLI client (Typer)                                                       │
│  □ VS Code extension                                                        │
│  □ API documentation (OpenAPI + GraphQL Playground)                         │
│  □ Rate limiting (Kong)                                                     │
│  □ OAuth2/OIDC authentication (Keycloak)                                    │
│                                                                             │
│  PHASE 5: Production Readiness (Weeks 13-14)                                │
│  ───────────────────────────────────────────                                │
│  □ Kubernetes deployment manifests                                          │
│  □ Helm charts for installation                                             │
│  □ Horizontal Pod Autoscaling                                               │
│  □ Prometheus metrics                                                       │
│  □ Grafana dashboards                                                       │
│  □ Alerting rules (PagerDuty/Slack)                                         │
│  □ Distributed tracing (Jaeger)                                             │
│  □ Centralized logging (Loki)                                               │
│  □ Integration tests                                                        │
│  □ Load testing (k6/Locust)                                                 │
│  □ Security audit                                                           │
│  □ Disaster recovery plan                                                   │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 🔗 References & Resources

| Resource | Description |
|----------|-------------|
| [Neo4j Graph Algorithms](https://neo4j.com/docs/graph-data-science/current/) | Graph algorithms library |
| [Tree-sitter](https://tree-sitter.github.io/tree-sitter/) | Multi-language parsing |
| [Strawberry GraphQL](https://strawberry.rocks/) | Python GraphQL library |
| [Your Code as a Crime Scene](https://pragprog.com/titles/atcrime/your-code-as-a-crime-scene/) | Coupling analysis concepts |
| [CodeBERT](https://github.com/microsoft/CodeBERT) | Code embeddings model |

---

*Document Version: 1.0.0 | Last Updated: 2026-02-06*
