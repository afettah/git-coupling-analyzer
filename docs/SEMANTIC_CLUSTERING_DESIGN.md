# Semantic Clustering — Domain Discovery Through Code Intelligence

> **Version**: 1.0  
> **Status**: Design Draft  
> **Created**: February 6, 2026  
> **Purpose**: Automatic domain boundary discovery using semantic analysis of code structure, naming, and relationships

---

## Executive Summary

Semantic Clustering extends LFCA beyond temporal coupling analysis to discover **business domains** and **logical boundaries** through deep semantic analysis of code. Unlike commit-based coupling (which answers "what changes together?"), semantic clustering answers:

- **"What belongs together?"** — Files with similar purpose/domain
- **"What domains exist in this codebase?"** — Automatic bounded context discovery
- **"Which domain does this class serve?"** — Entity-to-domain mapping

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                    SEMANTIC CLUSTERING OVERVIEW                              │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│   ┌───────────────┐     ┌───────────────┐     ┌───────────────┐            │
│   │   Codebase    │────▶│   Semantic    │────▶│    Domain     │            │
│   │   Analysis    │     │   Embedding   │     │   Clusters    │            │
│   └───────────────┘     └───────────────┘     └───────────────┘            │
│          │                     │                     │                      │
│          ▼                     ▼                     ▼                      │
│   ┌───────────────┐     ┌───────────────┐     ┌───────────────┐            │
│   │ • AST Parsing │     │ • Code2Vec    │     │ • Payment     │            │
│   │ • Token Filter│     │ • TF-IDF      │     │ • Auth        │            │
│   │ • Name Extract│     │ • BERT Embeds │     │ • Inventory   │            │
│   │ • Type Analyze│     │ • Graph Embeds│     │ • Reporting   │            │
│   └───────────────┘     └───────────────┘     └───────────────┘            │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Table of Contents

1. [Vision & Goals](#1-vision--goals)
2. [Core Concepts](#2-core-concepts)
3. [Feature Specifications](#3-feature-specifications)
4. [Algorithms & Techniques](#4-algorithms--techniques)
5. [Technology Choices](#5-technology-choices)
6. [Architecture](#6-architecture)
7. [API Design](#7-api-design)
8. [Data Models](#8-data-models)
9. [Implementation Roadmap](#9-implementation-roadmap)
10. [Success Metrics](#10-success-metrics)

---

## 1. Vision & Goals

### 1.1 Vision Statement

Transform any codebase into a **discoverable domain map** by analyzing code semantics — class names, method signatures, comments, variable names, and structural patterns — to automatically identify business domains and their boundaries.

### 1.2 Primary Goals

| Goal | Description | Value |
|------|-------------|-------|
| **Domain Discovery** | Automatically identify business domains (Payment, Auth, Inventory...) | Understand legacy codebases |
| **Entity Classification** | For any class, know which domain(s) it belongs to | Navigate large codebases |
| **Similarity Grouping** | Group semantically similar classes/files | Identify duplication, cohesion |
| **Boundary Detection** | Find where one domain ends and another begins | Architecture documentation |
| **Tech Token Filtering** | Exclude framework noise (.NET, Spring, React tokens) | Focus on business semantics |

### 1.3 What This Feature Enables

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                        USE CASES ENABLED                                     │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  👤 FOR DEVELOPERS                                                          │
│  ──────────────────                                                         │
│  • "Show me all files related to payment processing"                        │
│  • "Which domain should this new feature go into?"                          │
│  • "Find similar code to what I'm writing"                                  │
│                                                                             │
│  🏗️ FOR ARCHITECTS                                                          │
│  ──────────────────                                                         │
│  • "What are the natural bounded contexts in our monolith?"                 │
│  • "Which domains have the most cross-cutting concerns?"                    │
│  • "Are there files that span multiple domains (god classes)?"              │
│                                                                             │
│  📊 FOR TECH LEADS                                                          │
│  ──────────────────                                                         │
│  • "Generate domain ownership assignments"                                  │
│  • "Identify microservice extraction candidates"                            │
│  • "Document implicit domain boundaries"                                    │
│                                                                             │
│  🔄 FOR MIGRATION PROJECTS                                                  │
│  ──────────────────────────                                                 │
│  • "Map legacy codebase domains before refactoring"                         │
│  • "Identify domain clusters for team assignment"                           │
│  • "Find hidden dependencies between domains"                               │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 2. Core Concepts

### 2.1 Glossary

| Term | Definition |
|------|------------|
| **Semantic Token** | A meaningful identifier extracted from code (class name, method name, variable) |
| **Technical Token** | Framework/language-specific tokens to be filtered (DbContext, IRepository, useState) |
| **Domain Cluster** | A group of semantically related files/classes representing a business domain |
| **Embedding Vector** | Numerical representation of code semantics in high-dimensional space |
| **Domain Affinity** | Score indicating how strongly an entity belongs to a specific domain |
| **Bridge Entity** | A file/class that spans multiple domains (potential god class or shared utility) |
| **Semantic Signature** | The extracted semantic fingerprint of a code entity |

### 2.2 Semantic Analysis Dimensions

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                    SEMANTIC ANALYSIS DIMENSIONS                              │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  1. LEXICAL (Names & Text)                                                  │
│     ├── Class names: PaymentProcessor, OrderService, UserRepository        │
│     ├── Method names: calculateTax, validatePayment, processRefund         │
│     ├── Variable names: orderTotal, customerId, invoiceNumber              │
│     ├── Comments & documentation strings                                   │
│     └── String literals with business meaning                              │
│                                                                             │
│  2. STRUCTURAL (Relationships)                                              │
│     ├── Inheritance hierarchies                                            │
│     ├── Interface implementations                                          │
│     ├── Method call graphs                                                 │
│     ├── Type dependencies (parameters, return types)                       │
│     └── Namespace/package organization                                     │
│                                                                             │
│  3. BEHAVIORAL (Patterns)                                                   │
│     ├── Design pattern detection (Repository, Factory, Service...)         │
│     ├── CRUD operation patterns                                            │
│     ├── Event handlers and callbacks                                       │
│     └── Data flow patterns                                                 │
│                                                                             │
│  4. CONTEXTUAL (Position)                                                   │
│     ├── Directory/folder structure                                         │
│     ├── Module organization                                                │
│     ├── Test file associations                                             │
│     └── Configuration file relationships                                   │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 2.3 Technical Token Filtering

Technical tokens are framework/language-specific identifiers that add noise to domain analysis. The system maintains **technology-specific stopword lists**.

```python
# Example: .NET Technical Tokens
DOTNET_TECHNICAL_TOKENS = {
    # Entity Framework
    "DbContext", "DbSet", "IQueryable", "EntityTypeConfiguration",
    "OnModelCreating", "HasKey", "HasIndex", "ToTable",
    
    # ASP.NET
    "Controller", "ApiController", "ActionResult", "IActionResult",
    "HttpGet", "HttpPost", "HttpPut", "HttpDelete", "Route",
    "Authorize", "AllowAnonymous", "FromBody", "FromQuery",
    
    # Dependency Injection
    "IServiceCollection", "IServiceProvider", "AddScoped", 
    "AddSingleton", "AddTransient", "IOptions",
    
    # Common Patterns
    "Repository", "UnitOfWork", "Specification", "Handler",
    "Command", "Query", "Event", "Dto", "ViewModel",
    
    # Generic Types
    "IEnumerable", "ICollection", "IList", "Task", "Async",
    "CancellationToken", "ILogger", "IConfiguration"
}

# Example: React/TypeScript Technical Tokens
REACT_TECHNICAL_TOKENS = {
    # React Core
    "useState", "useEffect", "useCallback", "useMemo", "useRef",
    "useContext", "useReducer", "Component", "PureComponent",
    
    # Lifecycle
    "componentDidMount", "componentWillUnmount", "render",
    "getDerivedStateFromProps", "shouldComponentUpdate",
    
    # Patterns
    "Provider", "Consumer", "Context", "Suspense", "ErrorBoundary",
    "HOC", "withRouter", "connect", "dispatch", "reducer",
    
    # TypeScript
    "interface", "type", "Props", "State", "FC", "ReactNode"
}
```

---

## 3. Feature Specifications

### 3.1 Feature 1: Domain Discovery

**Description**: Automatically analyze a codebase and discover distinct business domains.

```
INPUT:  Repository path + configuration
OUTPUT: List of discovered domains with:
        - Domain name (auto-generated or suggested)
        - Member files/classes
        - Domain keywords (extracted concepts)
        - Cohesion score
        - Inter-domain coupling map
```

**Workflow**:
```
┌─────────────┐     ┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│   1. Parse  │────▶│  2. Extract │────▶│  3. Embed   │────▶│  4. Cluster │
│   Codebase  │     │   Tokens    │     │   Vectors   │     │   Domains   │
└─────────────┘     └─────────────┘     └─────────────┘     └─────────────┘
                           │                                       │
                           ▼                                       ▼
                    ┌─────────────┐                         ┌─────────────┐
                    │  5. Filter  │                         │  6. Name    │
                    │  Tech Tokens│                         │  Domains    │
                    └─────────────┘                         └─────────────┘
```

### 3.2 Feature 2: Entity-to-Domain Classification

**Description**: Given any class/file, determine which domain(s) it belongs to.

```
INPUT:  File path (e.g., "src/services/PaymentProcessor.cs")
OUTPUT: Domain classification:
        - Primary domain: "Payment" (affinity: 0.87)
        - Secondary domains: ["Billing" (0.34), "Order" (0.21)]
        - Confidence: 0.92
        - Reasoning: "Contains payment-related terms, inherits from billing base..."
```

### 3.3 Feature 3: Similarity Search

**Description**: Find files/classes semantically similar to a given entity.

```
INPUT:  Source file path + similarity threshold
OUTPUT: Ranked list of similar entities:
        - Similar file path
        - Similarity score
        - Shared concepts
        - Relationship type (same domain, utility, test, etc.)
```

### 3.4 Feature 4: Domain Boundary Visualization

**Description**: Visual representation of domain clusters and their relationships.

```
OUTPUT: Interactive visualization showing:
        - Domain clusters as colored regions
        - Files as nodes within clusters
        - Inter-domain edges
        - Bridge files highlighted
        - Drill-down into individual domains
```

### 3.5 Feature 5: Technology-Aware Filtering

**Description**: Configure technology stack to exclude irrelevant tokens.

```
INPUT:  Technology profile configuration:
        - Primary: "dotnet"
        - Frameworks: ["entity-framework", "aspnet-core", "mediatr"]
        - Custom exclusions: ["MyCompanyBaseClass", "LegacyHelper"]
        
OUTPUT: Filtered semantic analysis focusing on business concepts
```

---

## 4. Algorithms & Techniques

### 4.1 Semantic Extraction Pipeline

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                    SEMANTIC EXTRACTION PIPELINE                              │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │ STAGE 1: AST PARSING                                                 │   │
│  │                                                                      │   │
│  │  Source Code ──▶ Tree-Sitter ──▶ Syntax Tree ──▶ Typed Nodes        │   │
│  │                                                                      │   │
│  │  Extractors per language:                                           │   │
│  │  • C#: Roslyn Analyzer (preferred) / Tree-sitter-c-sharp            │   │
│  │  • Python: ast module / Tree-sitter-python                          │   │
│  │  • TypeScript: TypeScript Compiler API / Tree-sitter-typescript     │   │
│  │  • Java: JavaParser / Tree-sitter-java                              │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                       │                                     │
│                                       ▼                                     │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │ STAGE 2: TOKEN EXTRACTION                                           │   │
│  │                                                                      │   │
│  │  Extract from:                                                      │   │
│  │  ├── Class/Interface names                                          │   │
│  │  ├── Method names + parameter names                                 │   │
│  │  ├── Property/Field names + types                                   │   │
│  │  ├── Local variable names                                           │   │
│  │  ├── Comments (doc strings, inline)                                 │   │
│  │  ├── String literals (meaningful ones)                              │   │
│  │  └── Namespace/package names                                        │   │
│  │                                                                      │   │
│  │  Apply: CamelCase/snake_case splitting, lowercasing                 │   │
│  │  Output: ["payment", "processor", "calculate", "tax", "invoice"...] │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                       │                                     │
│                                       ▼                                     │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │ STAGE 3: TOKEN FILTERING                                            │   │
│  │                                                                      │   │
│  │  Remove:                                                            │   │
│  │  ├── Technology-specific tokens (configured per stack)              │   │
│  │  ├── Generic programming terms ("get", "set", "create", "update")   │   │
│  │  ├── Language keywords                                              │   │
│  │  ├── Common stopwords                                               │   │
│  │  └── Single-character tokens                                        │   │
│  │                                                                      │   │
│  │  Keep:                                                              │   │
│  │  ├── Business domain terms                                          │   │
│  │  ├── Entity names (nouns)                                           │   │
│  │  └── Action verbs with business meaning                             │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                       │                                     │
│                                       ▼                                     │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │ STAGE 4: SEMANTIC ENRICHMENT                                        │   │
│  │                                                                      │   │
│  │  Apply NLP techniques:                                              │   │
│  │  ├── Lemmatization (invoices → invoice)                             │   │
│  │  ├── Synonym expansion (order ↔ purchase)                           │   │
│  │  ├── Compound term detection (credit_card → credit-card)            │   │
│  │  └── Abbreviation expansion (acct → account)                        │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 4.2 Embedding Techniques

The system supports multiple embedding approaches, selected based on accuracy vs. performance tradeoffs:

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                       EMBEDDING TECHNIQUES                                   │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  TECHNIQUE 1: TF-IDF + LSA (Fast, Baseline)                                 │
│  ═══════════════════════════════════════════                                │
│                                                                             │
│  1. Build corpus: Each file = document of extracted tokens                  │
│  2. Compute TF-IDF vectors with sublinear TF                               │
│  3. Apply Latent Semantic Analysis (LSA/SVD) for dimensionality reduction  │
│  4. Output: Dense vectors (100-300 dimensions)                             │
│                                                                             │
│  Pros: Fast, interpretable, no ML model needed                             │
│  Cons: Misses semantic relationships                                       │
│                                                                             │
│  ─────────────────────────────────────────────────────────────────────────  │
│                                                                             │
│  TECHNIQUE 2: FastText / Word2Vec Aggregation (Balanced)                    │
│  ═══════════════════════════════════════════════════════                    │
│                                                                             │
│  1. Train domain-specific word embeddings on codebase                       │
│  2. For each file, average token embeddings (weighted by TF-IDF)           │
│  3. Optional: Smooth IDF for rare terms                                    │
│  4. Output: Dense vectors (100-300 dimensions)                             │
│                                                                             │
│  Pros: Captures semantic similarity (payment ≈ billing)                    │
│  Cons: Requires training, misses context                                   │
│                                                                             │
│  ─────────────────────────────────────────────────────────────────────────  │
│                                                                             │
│  TECHNIQUE 3: CodeBERT / GraphCodeBERT (High Accuracy)                      │
│  ═════════════════════════════════════════════════════                      │
│                                                                             │
│  1. Use pre-trained code understanding model                               │
│  2. Feed: [CLS] class_name methods properties [SEP]                        │
│  3. Extract [CLS] token embedding                                          │
│  4. Output: Dense vectors (768 dimensions)                                 │
│                                                                             │
│  Pros: State-of-the-art semantic understanding                             │
│  Cons: Slow, requires GPU for large codebases                              │
│                                                                             │
│  ─────────────────────────────────────────────────────────────────────────  │
│                                                                             │
│  TECHNIQUE 4: Graph Neural Network Embeddings (Structural)                  │
│  ═════════════════════════════════════════════════════════                  │
│                                                                             │
│  1. Build code graph: files as nodes, dependencies as edges               │
│  2. Apply GraphSAGE / GAT to learn node embeddings                        │
│  3. Combine with lexical embeddings (multi-modal)                          │
│  4. Output: Dense vectors (128-256 dimensions)                             │
│                                                                             │
│  Pros: Captures structural patterns                                        │
│  Cons: Complex, requires graph construction                                │
│                                                                             │
│  ─────────────────────────────────────────────────────────────────────────  │
│                                                                             │
│  TECHNIQUE 5: Hybrid Ensemble (Recommended)                                 │
│  ═════════════════════════════════════════                                  │
│                                                                             │
│  1. Compute TF-IDF vectors for lexical baseline                            │
│  2. Compute Word2Vec aggregations for semantic similarity                  │
│  3. Compute graph embeddings for structural patterns                       │
│  4. Concatenate and project to final embedding space                       │
│  5. Output: Dense vectors (256 dimensions)                                 │
│                                                                             │
│  ┌─────────┐   ┌─────────┐   ┌─────────┐                                   │
│  │ TF-IDF  │   │Word2Vec │   │  Graph  │                                   │
│  │ (100d)  │   │ (100d)  │   │  (64d)  │                                   │
│  └────┬────┘   └────┬────┘   └────┬────┘                                   │
│       │             │             │                                         │
│       └─────────────┼─────────────┘                                         │
│                     │                                                       │
│                     ▼                                                       │
│            ┌─────────────────┐                                             │
│            │   Projection    │                                             │
│            │    (256d)       │                                             │
│            └─────────────────┘                                             │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 4.3 Clustering Algorithms

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                       CLUSTERING ALGORITHMS                                  │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  ALGORITHM 1: HDBSCAN (Primary Choice)                                      │
│  ════════════════════════════════════                                       │
│                                                                             │
│  Hierarchical Density-Based Spatial Clustering                             │
│                                                                             │
│  Why HDBSCAN for Domain Discovery:                                         │
│  ✓ No need to pre-specify number of clusters                               │
│  ✓ Handles varying cluster densities (large vs small domains)              │
│  ✓ Identifies outliers (utility classes, god classes)                      │
│  ✓ Provides cluster hierarchy (domain → subdomain)                         │
│  ✓ Soft clustering available (for multi-domain entities)                   │
│                                                                             │
│  Parameters:                                                                │
│  • min_cluster_size: Minimum domain size (default: 5)                      │
│  • min_samples: Core point threshold (default: 3)                          │
│  • cluster_selection_epsilon: Merge threshold (default: 0.3)               │
│  • metric: cosine (for normalized embeddings)                              │
│                                                                             │
│  ─────────────────────────────────────────────────────────────────────────  │
│                                                                             │
│  ALGORITHM 2: Agglomerative Hierarchical (Domain Hierarchy)                 │
│  ══════════════════════════════════════════════════════════                 │
│                                                                             │
│  For discovering domain hierarchies (Payment > Refund, Payment > Invoice)  │
│                                                                             │
│  Linkage methods:                                                          │
│  • Ward: Minimizes variance (good for balanced clusters)                   │
│  • Average: Uses mean distances (good for elongated clusters)              │
│  • Complete: Uses max distances (good for compact clusters)                │
│                                                                             │
│  Output: Dendrogram allowing exploration at different granularities        │
│                                                                             │
│  ─────────────────────────────────────────────────────────────────────────  │
│                                                                             │
│  ALGORITHM 3: Spectral Clustering (Structure-Aware)                         │
│  ═══════════════════════════════════════════════════                        │
│                                                                             │
│  For when structural relationships are important                           │
│                                                                             │
│  1. Build similarity graph from embeddings                                 │
│  2. Compute graph Laplacian                                                │
│  3. Find eigenvectors of Laplacian                                         │
│  4. Cluster in spectral space with K-means                                 │
│                                                                             │
│  Benefits: Captures non-convex cluster shapes                              │
│                                                                             │
│  ─────────────────────────────────────────────────────────────────────────  │
│                                                                             │
│  ALGORITHM 4: Topic Modeling (LDA/NMF) (Interpretable)                      │
│  ════════════════════════════════════════════════════                       │
│                                                                             │
│  Treat domains as "topics" in a topic model                                │
│                                                                             │
│  Benefits:                                                                  │
│  • Each domain has interpretable keywords                                  │
│  • Soft clustering: files can belong to multiple domains                   │
│  • Can generate domain names from top keywords                             │
│                                                                             │
│  LDA Output Example:                                                       │
│  Domain 0 (0.23): payment, invoice, billing, refund, charge               │
│  Domain 1 (0.19): user, auth, login, permission, role                     │
│  Domain 2 (0.15): order, cart, checkout, shipping, delivery               │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 4.4 Domain Naming Algorithm

```python
def auto_name_domain(cluster_files: list, extracted_tokens: dict) -> str:
    """
    Automatically generate a domain name from clustered files.
    
    Algorithm:
    1. Aggregate all tokens from cluster files
    2. Apply TF-IDF within the cluster (corpus = all clusters)
    3. Select top N distinctive terms
    4. Apply naming heuristics:
       - Prefer nouns over verbs
       - Prefer singular over plural
       - Remove generic terms
       - Combine related terms
    5. Format as domain name
    """
    
    # Collect tokens from cluster
    cluster_tokens = Counter()
    for file in cluster_files:
        cluster_tokens.update(extracted_tokens[file])
    
    # Calculate distinctiveness (TF-IDF across clusters)
    distinctive_terms = calculate_tfidf_distinctiveness(
        cluster_tokens, 
        all_clusters_tokens
    )
    
    # Filter and rank terms
    ranked_terms = []
    for term, score in distinctive_terms:
        if is_noun(term) and not is_generic(term):
            ranked_terms.append((term, score * 1.5))  # Boost nouns
        elif is_verb(term) and is_domain_verb(term):
            ranked_terms.append((term, score))
    
    # Generate name from top terms
    top_terms = sorted(ranked_terms, key=lambda x: -x[1])[:3]
    
    # Apply naming patterns
    if len(top_terms) == 1:
        return capitalize(top_terms[0][0])
    elif are_related(top_terms[0][0], top_terms[1][0]):
        return capitalize(top_terms[0][0])  # Use primary
    else:
        return f"{capitalize(top_terms[0][0])}-{capitalize(top_terms[1][0])}"
```

### 4.5 Multi-Domain Entity Detection

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                   MULTI-DOMAIN ENTITY DETECTION                              │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  Some entities legitimately span multiple domains:                          │
│  • OrderPaymentService → Order + Payment                                    │
│  • UserAuthorizationHandler → User + Auth                                   │
│  • BillingReportGenerator → Billing + Reporting                            │
│                                                                             │
│  DETECTION ALGORITHM:                                                       │
│                                                                             │
│  1. Compute soft cluster membership using HDBSCAN probability              │
│     membership = hdbscan.membership_vector(entity_embedding)               │
│                                                                             │
│  2. Identify multi-domain candidates:                                       │
│     if count(membership > 0.2) >= 2:                                       │
│         entity.is_multi_domain = True                                      │
│         entity.domain_affinities = {                                       │
│             domain_id: membership[domain_id]                               │
│             for domain_id, prob in enumerate(membership)                   │
│             if prob > 0.2                                                  │
│         }                                                                  │
│                                                                             │
│  3. Classify multi-domain entity type:                                     │
│     ┌────────────────────┬────────────────────────────────────────────┐   │
│     │ Type               │ Detection Pattern                          │   │
│     ├────────────────────┼────────────────────────────────────────────┤   │
│     │ Integration Point  │ High affinity to 2 domains, mediator role │   │
│     │ God Class          │ High affinity to 3+ domains                │   │
│     │ Shared Utility     │ Low-medium affinity to many domains       │   │
│     │ Legitimate Bridge  │ High affinity to 2 related domains        │   │
│     └────────────────────┴────────────────────────────────────────────┘   │
│                                                                             │
│  4. Generate recommendations:                                              │
│     - God Class → "Consider splitting into domain-specific services"       │
│     - Integration Point → "Document as intentional integration"            │
│     - Shared Utility → "Move to shared/common module"                      │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 5. Technology Choices

### 5.1 Core Technology Stack

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                       TECHNOLOGY STACK                                       │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  COMPONENT              TECHNOLOGY                  RATIONALE               │
│  ────────────────────────────────────────────────────────────────────────── │
│                                                                             │
│  AST Parsing           Tree-sitter (multi-lang)   Fast, incremental,       │
│                        + Roslyn (.NET)             language-specific depth  │
│                        + TypeScript Compiler       for complex languages    │
│                                                                             │
│  NLP Processing        spaCy (lemmatization)      Industrial NLP library   │
│                        NLTK (tokenization)         Comprehensive toolkit    │
│                                                                             │
│  Word Embeddings       Gensim (Word2Vec/FastText)  Proven, efficient       │
│                        + sentence-transformers      Pre-trained models      │
│                                                                             │
│  Code Embeddings       CodeBERT (optional GPU)     State-of-art code       │
│                        UniXcoder (multilingual)    understanding           │
│                                                                             │
│  Vector Storage        Qdrant                      Purpose-built vector DB  │
│                        (alt: Chroma for embedded)   Fast similarity search  │
│                                                                             │
│  Clustering            scikit-learn (baseline)     Comprehensive library   │
│                        HDBSCAN (density-based)     No K required           │
│                        umap-learn (dim reduction)   Preserves structure    │
│                                                                             │
│  Graph Analysis        NetworkX (Python)           Standard graph lib      │
│                        igraph (performance)         For large graphs        │
│                                                                             │
│  Visualization         D3.js (frontend)            Interactive clusters    │
│                        Plotly (backend reports)    Static exports          │
│                        UMAP plots                   2D projections          │
│                                                                             │
│  API Framework         FastAPI                     Existing LFCA stack     │
│                        Pydantic (validation)        Type safety            │
│                                                                             │
│  Caching               Redis                       Embedding cache         │
│                        SQLite (local)              File metadata           │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 5.2 Python Dependencies

```toml
# pyproject.toml additions

[project.optional-dependencies]
semantic = [
    # AST Parsing
    "tree-sitter>=0.20.0",
    "tree-sitter-python>=0.20.0",
    "tree-sitter-javascript>=0.20.0",
    "tree-sitter-typescript>=0.20.0",
    "tree-sitter-c-sharp>=0.20.0",
    "tree-sitter-java>=0.20.0",
    
    # NLP
    "spacy>=3.5.0",
    "nltk>=3.8.0",
    
    # Embeddings
    "gensim>=4.3.0",
    "sentence-transformers>=2.2.0",
    
    # Vector Storage
    "qdrant-client>=1.7.0",
    # Alternative: "chromadb>=0.4.0",
    
    # Clustering & ML
    "hdbscan>=0.8.33",
    "umap-learn>=0.5.3",
    "scikit-learn>=1.3.0",
    
    # Graph
    "networkx>=3.0",
    "python-igraph>=0.10.0",
    
    # Visualization
    "plotly>=5.18.0",
    "matplotlib>=3.8.0",
]

semantic-gpu = [
    "torch>=2.0.0",
    "transformers>=4.35.0",  # For CodeBERT
]
```

### 5.3 Technology Profiles

Pre-configured profiles for common technology stacks:

```yaml
# configs/tech_profiles/dotnet.yaml
name: ".NET / C#"
version: "1.0"

languages:
  - csharp
  - fsharp

parsers:
  csharp:
    primary: roslyn  # Best accuracy for C#
    fallback: tree-sitter-c-sharp

token_filters:
  # Framework tokens to exclude
  aspnetcore:
    - Controller
    - ApiController
    - ControllerBase
    - ActionResult
    - IActionResult
    - Task<*>
    - HttpGet
    - HttpPost
    - HttpPut
    - HttpDelete
    - Authorize
    - AllowAnonymous
    - FromBody
    - FromQuery
    - FromRoute
    
  entity_framework:
    - DbContext
    - DbSet
    - IQueryable
    - EntityTypeConfiguration
    - OnModelCreating
    - HasKey
    - HasIndex
    - ToTable
    - Migration
    
  dependency_injection:
    - IServiceCollection
    - IServiceProvider
    - ServiceLifetime
    - AddScoped
    - AddSingleton
    - AddTransient
    - IOptions
    - IConfiguration
    
  mediatr:
    - IRequest
    - IRequestHandler
    - INotification
    - INotificationHandler
    - MediatR
    
  common_patterns:
    - Repository
    - IRepository
    - UnitOfWork
    - IUnitOfWork
    - Specification
    - Handler
    - Command
    - Query
    - Dto
    - ViewModel
    - Request
    - Response

  generic_base_types:
    - object
    - string
    - int
    - long
    - bool
    - decimal
    - DateTime
    - Guid
    - Task
    - Async
    - CancellationToken

# Namespace patterns to classify as infrastructure (not domain)
infrastructure_patterns:
  - "*.Infrastructure.*"
  - "*.Persistence.*"
  - "*.Data.*"
  - "*.Migrations.*"
  - "*.Configuration.*"

# Test file patterns to handle separately
test_patterns:
  - "*Tests.cs"
  - "*Test.cs"
  - "*.Specs.cs"
  - "*Fixture.cs"
```

---

## 6. Architecture

### 6.1 High-Level Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                    SEMANTIC CLUSTERING ARCHITECTURE                          │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  ┌──────────────────────────────────────────────────────────────────────┐  │
│  │                           API LAYER                                   │  │
│  │  ┌───────────┐  ┌───────────┐  ┌───────────┐  ┌───────────────────┐ │  │
│  │  │  /domains │  │/similarity│  │ /classify │  │ /visualizations  │ │  │
│  │  └─────┬─────┘  └─────┬─────┘  └─────┬─────┘  └─────────┬─────────┘ │  │
│  └────────┼──────────────┼──────────────┼──────────────────┼───────────┘  │
│           │              │              │                  │               │
│           └──────────────┴──────────────┴──────────────────┘               │
│                                   │                                         │
│                                   ▼                                         │
│  ┌──────────────────────────────────────────────────────────────────────┐  │
│  │                        SERVICE LAYER                                  │  │
│  │                                                                       │  │
│  │  ┌─────────────────────┐     ┌─────────────────────┐                 │  │
│  │  │  SemanticAnalyzer   │     │  DomainClusterer    │                 │  │
│  │  │                     │     │                     │                 │  │
│  │  │  • parse_codebase() │     │  • discover()       │                 │  │
│  │  │  • extract_tokens() │     │  • classify()       │                 │  │
│  │  │  • filter_tokens()  │     │  • find_similar()   │                 │  │
│  │  │  • compute_embeds() │     │  • get_boundaries() │                 │  │
│  │  └──────────┬──────────┘     └──────────┬──────────┘                 │  │
│  │             │                           │                             │  │
│  └─────────────┼───────────────────────────┼─────────────────────────────┘  │
│                │                           │                                 │
│                ▼                           ▼                                 │
│  ┌──────────────────────────────────────────────────────────────────────┐  │
│  │                        PROCESSING LAYER                               │  │
│  │                                                                       │  │
│  │  ┌───────────────┐  ┌───────────────┐  ┌───────────────┐             │  │
│  │  │  AST Parsers  │  │  Embedders    │  │  Clusterers   │             │  │
│  │  │               │  │               │  │               │             │  │
│  │  │ • TreeSitter  │  │ • TF-IDF      │  │ • HDBSCAN     │             │  │
│  │  │ • Roslyn      │  │ • Word2Vec    │  │ • Hierarchical│             │  │
│  │  │ • TypeScript  │  │ • CodeBERT    │  │ • Spectral    │             │  │
│  │  │ • JavaParser  │  │ • Graph       │  │ • LDA/NMF     │             │  │
│  │  └───────┬───────┘  └───────┬───────┘  └───────┬───────┘             │  │
│  │          │                  │                  │                      │  │
│  └──────────┼──────────────────┼──────────────────┼──────────────────────┘  │
│             │                  │                  │                         │
│             ▼                  ▼                  ▼                         │
│  ┌──────────────────────────────────────────────────────────────────────┐  │
│  │                         STORAGE LAYER                                 │  │
│  │                                                                       │  │
│  │  ┌───────────────┐  ┌───────────────┐  ┌───────────────┐             │  │
│  │  │ Token Store   │  │ Vector Store  │  │ Cluster Store │             │  │
│  │  │   (SQLite)    │  │   (Qdrant)    │  │   (SQLite)    │             │  │
│  │  │               │  │               │  │               │             │  │
│  │  │ • file_tokens │  │ • embeddings  │  │ • domains     │             │  │
│  │  │ • tech_filter │  │ • similarity  │  │ • membership  │             │  │
│  │  │ • metadata    │  │ • index       │  │ • hierarchy   │             │  │
│  │  └───────────────┘  └───────────────┘  └───────────────┘             │  │
│  │                                                                       │  │
│  └──────────────────────────────────────────────────────────────────────┘  │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 6.2 Module Structure

```
lfca/
├── semantic/                          # New semantic module
│   ├── __init__.py
│   │
│   ├── parsing/                       # AST parsing
│   │   ├── __init__.py
│   │   ├── base.py                    # BaseParser interface
│   │   ├── tree_sitter_parser.py      # Generic Tree-sitter
│   │   ├── csharp_parser.py           # C# with Roslyn
│   │   ├── python_parser.py           # Python ast module
│   │   ├── typescript_parser.py       # TypeScript compiler
│   │   └── registry.py                # Parser registry
│   │
│   ├── extraction/                    # Token extraction
│   │   ├── __init__.py
│   │   ├── extractor.py               # Token extractor
│   │   ├── splitters.py               # CamelCase, snake_case
│   │   └── enrichment.py              # Lemmatization, synonyms
│   │
│   ├── filtering/                     # Technical token filtering
│   │   ├── __init__.py
│   │   ├── filters.py                 # Token filter logic
│   │   ├── profiles/                  # Tech profile configs
│   │   │   ├── dotnet.yaml
│   │   │   ├── react.yaml
│   │   │   ├── spring.yaml
│   │   │   ├── django.yaml
│   │   │   └── generic.yaml
│   │   └── custom.py                  # Custom filter support
│   │
│   ├── embedding/                     # Embedding generation
│   │   ├── __init__.py
│   │   ├── base.py                    # BaseEmbedder interface
│   │   ├── tfidf_embedder.py          # TF-IDF + LSA
│   │   ├── word2vec_embedder.py       # Word2Vec aggregation
│   │   ├── codebert_embedder.py       # CodeBERT (optional)
│   │   ├── graph_embedder.py          # Graph neural network
│   │   ├── hybrid_embedder.py         # Ensemble of above
│   │   └── registry.py                # Embedder registry
│   │
│   ├── clustering/                    # Domain clustering
│   │   ├── __init__.py
│   │   ├── base.py                    # BaseClusterer interface
│   │   ├── hdbscan_clusterer.py       # HDBSCAN implementation
│   │   ├── hierarchical_clusterer.py  # Agglomerative
│   │   ├── spectral_clusterer.py      # Spectral clustering
│   │   ├── topic_clusterer.py         # LDA/NMF topic modeling
│   │   └── registry.py                # Clusterer registry
│   │
│   ├── domains/                       # Domain management
│   │   ├── __init__.py
│   │   ├── discovery.py               # Domain discovery service
│   │   ├── classification.py          # Entity classification
│   │   ├── naming.py                  # Auto-naming domains
│   │   ├── boundaries.py              # Boundary detection
│   │   └── multi_domain.py            # Multi-domain entities
│   │
│   ├── storage/                       # Persistence
│   │   ├── __init__.py
│   │   ├── token_store.py             # SQLite token storage
│   │   ├── vector_store.py            # Qdrant integration
│   │   └── domain_store.py            # Domain results storage
│   │
│   ├── similarity/                    # Similarity search
│   │   ├── __init__.py
│   │   ├── search.py                  # Similarity search service
│   │   └── ranking.py                 # Result ranking
│   │
│   └── config.py                      # Semantic config
│
├── api/
│   ├── routes/
│   │   └── semantic.py                # Semantic API endpoints
│
└── frontend/
    └── src/components/
        └── semantic/                  # Semantic UI components
            ├── DomainGraph.tsx
            ├── DomainList.tsx
            ├── SimilarityPanel.tsx
            └── ClusterViz.tsx
```

### 6.3 Data Flow

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                          DATA FLOW DIAGRAM                                   │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │ PHASE 1: EXTRACTION (Run Once, Update Incrementally)                │   │
│  │                                                                      │   │
│  │  Source Files ──▶ Parse ──▶ Extract ──▶ Filter ──▶ Token Store      │   │
│  │                    AST      Tokens     Tech                (SQLite)  │   │
│  │                                                                      │   │
│  │  Example:                                                           │   │
│  │  PaymentService.cs                                                  │   │
│  │    → AST nodes: [class:PaymentService, method:ProcessPayment, ...]  │   │
│  │    → Tokens: [payment, service, process, refund, invoice, ...]      │   │
│  │    → Filtered: [payment, process, refund, invoice] (removed generic) │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                       │                                     │
│                                       ▼                                     │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │ PHASE 2: EMBEDDING (Computed Per Embedder Config)                   │   │
│  │                                                                      │   │
│  │  Token Store ──▶ Vectorize ──▶ Reduce Dims ──▶ Vector Store         │   │
│  │                  (TF-IDF,     (UMAP/PCA)       (Qdrant)              │   │
│  │                   Word2Vec)                                         │   │
│  │                                                                      │   │
│  │  Example:                                                           │   │
│  │  PaymentService.cs                                                  │   │
│  │    → TF-IDF: [0.2, 0.8, 0.1, ...] (100d)                           │   │
│  │    → Word2Vec avg: [0.3, -0.1, 0.5, ...] (100d)                    │   │
│  │    → Combined: [0.25, 0.35, ...] (256d)                            │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                       │                                     │
│                                       ▼                                     │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │ PHASE 3: CLUSTERING (Triggered by User or Schedule)                 │   │
│  │                                                                      │   │
│  │  Vector Store ──▶ Cluster ──▶ Name ──▶ Analyze ──▶ Domain Store     │   │
│  │                  (HDBSCAN)    Domains   Boundaries   (SQLite)        │   │
│  │                                                                      │   │
│  │  Example:                                                           │   │
│  │  Cluster 0: [PaymentService, RefundHandler, InvoiceGenerator, ...]  │   │
│  │    → Name: "Payment"                                                │   │
│  │    → Keywords: [payment, refund, invoice, charge, billing]          │   │
│  │    → Cohesion: 0.87                                                 │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                       │                                     │
│                                       ▼                                     │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │ PHASE 4: QUERY (Real-time)                                          │   │
│  │                                                                      │   │
│  │  Query ──▶ Embed ──▶ Search ──▶ Rank ──▶ Response                   │   │
│  │                      (Qdrant)                                        │   │
│  │                                                                      │   │
│  │  Examples:                                                          │   │
│  │  • "Find similar to PaymentService" → [RefundHandler, BillingAPI]   │   │
│  │  • "Classify OrderProcessor" → Primary: Order (0.8), Secondary: ... │   │
│  │  • "Show Payment domain" → [12 files, 3 subdomains, 5 bridges]     │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 7. API Design

### 7.1 REST API Endpoints

```yaml
# ═══════════════════════════════════════════════════════════════════════════
#                    SEMANTIC CLUSTERING API
# ═══════════════════════════════════════════════════════════════════════════

# ─────────────────────────────────────────────────────────────────────────────
# DOMAIN DISCOVERY
# ─────────────────────────────────────────────────────────────────────────────

POST /repos/{repo_id}/semantic/analyze:
  summary: Start semantic analysis of repository
  requestBody:
    content:
      application/json:
        schema:
          type: object
          properties:
            config:
              $ref: '#/components/schemas/SemanticConfig'
            directories:
              type: array
              items: { type: string }
              description: "Directories to analyze (empty = all)"
            exclude_patterns:
              type: array
              items: { type: string }
              description: "Glob patterns to exclude"
            tech_profile:
              type: string
              enum: [dotnet, react, spring, django, generic, custom]
            custom_filters:
              type: array
              items: { type: string }
              description: "Additional tokens to filter"
  responses:
    202:
      description: Analysis job started
      content:
        application/json:
          schema:
            type: object
            properties:
              job_id: { type: string }
              status: { type: string, enum: [queued, running] }

GET /repos/{repo_id}/semantic/domains:
  summary: Get discovered domains
  parameters:
    - name: run_id
      in: query
      description: "Specific run ID (latest if omitted)"
      schema: { type: string }
    - name: min_size
      in: query
      description: "Minimum domain size"
      schema: { type: integer, default: 3 }
    - name: include_outliers
      in: query
      description: "Include unclustered files"
      schema: { type: boolean, default: false }
  responses:
    200:
      content:
        application/json:
          schema:
            $ref: '#/components/schemas/DomainDiscoveryResult'

GET /repos/{repo_id}/semantic/domains/{domain_id}:
  summary: Get domain details
  responses:
    200:
      content:
        application/json:
          schema:
            $ref: '#/components/schemas/DomainDetails'

GET /repos/{repo_id}/semantic/domains/{domain_id}/files:
  summary: Get files in domain
  parameters:
    - name: sort_by
      in: query
      schema: { type: string, enum: [affinity, name, path] }
    - name: limit
      in: query
      schema: { type: integer, default: 100 }
  responses:
    200:
      content:
        application/json:
          schema:
            type: array
            items:
              $ref: '#/components/schemas/DomainFile'

# ─────────────────────────────────────────────────────────────────────────────
# CLASSIFICATION
# ─────────────────────────────────────────────────────────────────────────────

POST /repos/{repo_id}/semantic/classify:
  summary: Classify entity into domains
  requestBody:
    content:
      application/json:
        schema:
          type: object
          properties:
            path:
              type: string
              description: "File path to classify"
            content:
              type: string
              description: "Optional: raw content (for uncommitted files)"
  responses:
    200:
      content:
        application/json:
          schema:
            $ref: '#/components/schemas/ClassificationResult'

POST /repos/{repo_id}/semantic/classify/batch:
  summary: Classify multiple entities
  requestBody:
    content:
      application/json:
        schema:
          type: object
          properties:
            paths:
              type: array
              items: { type: string }
  responses:
    200:
      content:
        application/json:
          schema:
            type: array
            items:
              $ref: '#/components/schemas/ClassificationResult'

# ─────────────────────────────────────────────────────────────────────────────
# SIMILARITY SEARCH
# ─────────────────────────────────────────────────────────────────────────────

GET /repos/{repo_id}/semantic/similar:
  summary: Find similar files
  parameters:
    - name: path
      in: query
      required: true
      schema: { type: string }
    - name: limit
      in: query
      schema: { type: integer, default: 20 }
    - name: min_similarity
      in: query
      schema: { type: number, default: 0.5 }
    - name: same_domain
      in: query
      description: "Only return files from same domain"
      schema: { type: boolean, default: false }
  responses:
    200:
      content:
        application/json:
          schema:
            $ref: '#/components/schemas/SimilarityResult'

POST /repos/{repo_id}/semantic/similar/query:
  summary: Find similar files by description
  description: "Natural language query for similar code"
  requestBody:
    content:
      application/json:
        schema:
          type: object
          properties:
            query:
              type: string
              description: "Natural language description"
              example: "code that handles credit card payments"
            limit:
              type: integer
              default: 20
  responses:
    200:
      content:
        application/json:
          schema:
            $ref: '#/components/schemas/SimilarityResult'

# ─────────────────────────────────────────────────────────────────────────────
# BOUNDARIES & ANALYSIS
# ─────────────────────────────────────────────────────────────────────────────

GET /repos/{repo_id}/semantic/boundaries:
  summary: Get domain boundary analysis
  responses:
    200:
      content:
        application/json:
          schema:
            $ref: '#/components/schemas/BoundaryAnalysis'

GET /repos/{repo_id}/semantic/bridges:
  summary: Get files spanning multiple domains
  parameters:
    - name: min_domains
      in: query
      schema: { type: integer, default: 2 }
  responses:
    200:
      content:
        application/json:
          schema:
            type: array
            items:
              $ref: '#/components/schemas/BridgeEntity'

GET /repos/{repo_id}/semantic/coupling:
  summary: Get inter-domain coupling matrix
  responses:
    200:
      content:
        application/json:
          schema:
            $ref: '#/components/schemas/DomainCouplingMatrix'

# ─────────────────────────────────────────────────────────────────────────────
# VISUALIZATION DATA
# ─────────────────────────────────────────────────────────────────────────────

GET /repos/{repo_id}/semantic/visualization/graph:
  summary: Get domain graph for visualization
  parameters:
    - name: level
      in: query
      description: "Aggregation level"
      schema: { type: string, enum: [domains, subdomains, files] }
  responses:
    200:
      content:
        application/json:
          schema:
            $ref: '#/components/schemas/DomainGraph'

GET /repos/{repo_id}/semantic/visualization/projection:
  summary: Get 2D projection of embeddings
  parameters:
    - name: method
      in: query
      schema: { type: string, enum: [umap, tsne, pca], default: umap }
    - name: color_by
      in: query
      schema: { type: string, enum: [domain, directory, extension] }
  responses:
    200:
      content:
        application/json:
          schema:
            $ref: '#/components/schemas/ProjectionData'

# ─────────────────────────────────────────────────────────────────────────────
# CONFIGURATION
# ─────────────────────────────────────────────────────────────────────────────

GET /semantic/profiles:
  summary: List available technology profiles
  responses:
    200:
      content:
        application/json:
          schema:
            type: array
            items:
              $ref: '#/components/schemas/TechProfile'

GET /semantic/profiles/{profile_id}:
  summary: Get technology profile details
  responses:
    200:
      content:
        application/json:
          schema:
            $ref: '#/components/schemas/TechProfileDetails'

POST /semantic/profiles:
  summary: Create custom technology profile
  requestBody:
    content:
      application/json:
        schema:
          $ref: '#/components/schemas/TechProfileCreate'
```

### 7.2 Response Schemas

```yaml
components:
  schemas:
    
    SemanticConfig:
      type: object
      properties:
        embedding:
          type: object
          properties:
            method:
              type: string
              enum: [tfidf, word2vec, codebert, hybrid]
              default: hybrid
            dimensions:
              type: integer
              default: 256
        clustering:
          type: object
          properties:
            algorithm:
              type: string
              enum: [hdbscan, hierarchical, spectral, lda]
              default: hdbscan
            min_cluster_size:
              type: integer
              default: 5
            min_samples:
              type: integer
              default: 3
        filters:
          type: object
          properties:
            tech_profile:
              type: string
              default: auto
            custom_stopwords:
              type: array
              items: { type: string }
            min_token_frequency:
              type: integer
              default: 2

    DomainDiscoveryResult:
      type: object
      properties:
        run_id:
          type: string
        created_at:
          type: string
          format: date-time
        config:
          $ref: '#/components/schemas/SemanticConfig'
        stats:
          type: object
          properties:
            files_analyzed: { type: integer }
            tokens_extracted: { type: integer }
            domains_found: { type: integer }
            outlier_files: { type: integer }
        domains:
          type: array
          items:
            $ref: '#/components/schemas/DomainSummary'
        
    DomainSummary:
      type: object
      properties:
        domain_id:
          type: string
        name:
          type: string
          description: "Auto-generated or user-defined name"
        keywords:
          type: array
          items: { type: string }
          description: "Top keywords characterizing domain"
        file_count:
          type: integer
        cohesion_score:
          type: number
          description: "Internal cohesion (0-1)"
        isolation_score:
          type: number
          description: "Separation from other domains (0-1)"
        subdomains:
          type: array
          items:
            $ref: '#/components/schemas/DomainSummary'

    DomainDetails:
      type: object
      properties:
        domain_id:
          type: string
        name:
          type: string
        keywords:
          type: array
          items:
            type: object
            properties:
              term: { type: string }
              weight: { type: number }
        files:
          type: array
          items:
            $ref: '#/components/schemas/DomainFile'
        metrics:
          type: object
          properties:
            cohesion: { type: number }
            isolation: { type: number }
            avg_file_affinity: { type: number }
            bridge_file_count: { type: integer }
        coupled_domains:
          type: array
          items:
            type: object
            properties:
              domain_id: { type: string }
              domain_name: { type: string }
              coupling_strength: { type: number }
              coupling_files: { type: integer }

    DomainFile:
      type: object
      properties:
        file_id:
          type: integer
        path:
          type: string
        affinity:
          type: number
          description: "How strongly file belongs to domain (0-1)"
        is_bridge:
          type: boolean
          description: "True if file spans multiple domains"
        other_domains:
          type: array
          items:
            type: object
            properties:
              domain_id: { type: string }
              affinity: { type: number }

    ClassificationResult:
      type: object
      properties:
        path:
          type: string
        primary_domain:
          type: object
          properties:
            domain_id: { type: string }
            name: { type: string }
            affinity: { type: number }
        secondary_domains:
          type: array
          items:
            type: object
            properties:
              domain_id: { type: string }
              name: { type: string }
              affinity: { type: number }
        confidence:
          type: number
          description: "Classification confidence (0-1)"
        is_outlier:
          type: boolean
          description: "True if doesn't fit any domain well"
        reasoning:
          type: array
          items:
            type: string
          description: "Explanation of classification"

    SimilarityResult:
      type: object
      properties:
        query_path:
          type: string
        similar_files:
          type: array
          items:
            type: object
            properties:
              path: { type: string }
              similarity: { type: number }
              shared_concepts:
                type: array
                items: { type: string }
              relationship:
                type: string
                enum: [same_domain, related_domain, utility, test]
              domain:
                type: object
                properties:
                  domain_id: { type: string }
                  name: { type: string }

    BridgeEntity:
      type: object
      properties:
        path:
          type: string
        file_id:
          type: integer
        domains:
          type: array
          items:
            type: object
            properties:
              domain_id: { type: string }
              name: { type: string }
              affinity: { type: number }
        classification:
          type: string
          enum: [integration_point, god_class, shared_utility, legitimate_bridge]
        recommendation:
          type: string

    DomainCouplingMatrix:
      type: object
      properties:
        domains:
          type: array
          items:
            type: object
            properties:
              domain_id: { type: string }
              name: { type: string }
        coupling_matrix:
          type: array
          items:
            type: array
            items: { type: number }
          description: "NxN matrix of coupling scores"
        strong_couplings:
          type: array
          items:
            type: object
            properties:
              from_domain: { type: string }
              to_domain: { type: string }
              strength: { type: number }
              coupling_files:
                type: array
                items: { type: string }

    DomainGraph:
      type: object
      properties:
        nodes:
          type: array
          items:
            type: object
            properties:
              id: { type: string }
              name: { type: string }
              type: { type: string, enum: [domain, subdomain, file] }
              size: { type: integer }
              color: { type: string }
              metrics:
                type: object
        edges:
          type: array
          items:
            type: object
            properties:
              source: { type: string }
              target: { type: string }
              weight: { type: number }
              type: { type: string }

    ProjectionData:
      type: object
      properties:
        method:
          type: string
        points:
          type: array
          items:
            type: object
            properties:
              file_id: { type: integer }
              path: { type: string }
              x: { type: number }
              y: { type: number }
              domain_id: { type: string }
              domain_name: { type: string }
              color: { type: string }
```

---

## 8. Data Models

### 8.1 Database Schema

```sql
-- ═══════════════════════════════════════════════════════════════════════════
--                    SEMANTIC CLUSTERING SCHEMA
-- ═══════════════════════════════════════════════════════════════════════════

-- data/repos/<repo_id>/artifacts/indexes/semantic.sqlite

-- ─────────────────────────────────────────────────────────────────────────────
-- SEMANTIC ANALYSIS RUNS
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE semantic_runs (
    run_id TEXT PRIMARY KEY,
    repo_id TEXT NOT NULL,
    state TEXT NOT NULL,  -- queued|running|complete|failed
    created_at TEXT NOT NULL,
    finished_at TEXT,
    
    -- Configuration
    config_json TEXT NOT NULL,
    tech_profile TEXT,
    directories_json TEXT,  -- Analyzed directories
    
    -- Git reference
    git_head_oid TEXT,
    
    -- Statistics
    files_analyzed INTEGER DEFAULT 0,
    tokens_extracted INTEGER DEFAULT 0,
    domains_found INTEGER DEFAULT 0,
    
    error TEXT
);

-- ─────────────────────────────────────────────────────────────────────────────
-- EXTRACTED TOKENS
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE file_tokens (
    file_id INTEGER NOT NULL,
    run_id TEXT NOT NULL,
    
    -- Raw extraction
    tokens_json TEXT NOT NULL,  -- Array of tokens with positions
    token_count INTEGER,
    
    -- Filtered tokens (after tech filter)
    filtered_tokens_json TEXT,
    filtered_count INTEGER,
    
    -- Metadata
    language TEXT,
    lines_of_code INTEGER,
    class_count INTEGER,
    method_count INTEGER,
    
    PRIMARY KEY (file_id, run_id),
    FOREIGN KEY (run_id) REFERENCES semantic_runs(run_id)
);

CREATE INDEX idx_file_tokens_run ON file_tokens(run_id);

-- Token frequency for TF-IDF computation
CREATE TABLE token_frequencies (
    run_id TEXT NOT NULL,
    token TEXT NOT NULL,
    document_frequency INTEGER,  -- How many files contain token
    total_frequency INTEGER,     -- Total occurrences
    
    PRIMARY KEY (run_id, token),
    FOREIGN KEY (run_id) REFERENCES semantic_runs(run_id)
);

-- ─────────────────────────────────────────────────────────────────────────────
-- DOMAINS
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE domains (
    domain_id TEXT PRIMARY KEY,
    run_id TEXT NOT NULL,
    parent_domain_id TEXT,  -- For hierarchical domains
    
    -- Identity
    name TEXT NOT NULL,
    auto_named BOOLEAN DEFAULT TRUE,
    
    -- Characterization
    keywords_json TEXT,  -- Top keywords with weights
    
    -- Metrics
    file_count INTEGER,
    cohesion_score REAL,
    isolation_score REAL,
    
    -- Hierarchy level (0 = top-level)
    level INTEGER DEFAULT 0,
    
    FOREIGN KEY (run_id) REFERENCES semantic_runs(run_id),
    FOREIGN KEY (parent_domain_id) REFERENCES domains(domain_id)
);

CREATE INDEX idx_domains_run ON domains(run_id);

-- ─────────────────────────────────────────────────────────────────────────────
-- FILE-DOMAIN MEMBERSHIP
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE domain_membership (
    file_id INTEGER NOT NULL,
    domain_id TEXT NOT NULL,
    run_id TEXT NOT NULL,
    
    -- Membership strength
    affinity REAL NOT NULL,  -- 0-1, how strongly file belongs
    is_primary BOOLEAN DEFAULT FALSE,
    
    -- Classification
    is_bridge BOOLEAN DEFAULT FALSE,  -- Spans multiple domains
    
    PRIMARY KEY (file_id, domain_id, run_id),
    FOREIGN KEY (domain_id) REFERENCES domains(domain_id)
);

CREATE INDEX idx_membership_file ON domain_membership(file_id, run_id);
CREATE INDEX idx_membership_domain ON domain_membership(domain_id);

-- ─────────────────────────────────────────────────────────────────────────────
-- INTER-DOMAIN COUPLING
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE domain_coupling (
    run_id TEXT NOT NULL,
    domain_a_id TEXT NOT NULL,
    domain_b_id TEXT NOT NULL,
    
    -- Coupling metrics
    coupling_strength REAL,  -- Computed from shared files & proximity
    bridge_file_count INTEGER,
    shared_keywords_json TEXT,
    
    PRIMARY KEY (run_id, domain_a_id, domain_b_id),
    FOREIGN KEY (domain_a_id) REFERENCES domains(domain_id),
    FOREIGN KEY (domain_b_id) REFERENCES domains(domain_id)
);

-- ─────────────────────────────────────────────────────────────────────────────
-- BRIDGE ENTITIES (Multi-Domain Files)
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE bridge_entities (
    file_id INTEGER NOT NULL,
    run_id TEXT NOT NULL,
    
    -- Classification
    entity_type TEXT,  -- integration_point, god_class, shared_utility, legitimate_bridge
    domain_count INTEGER,
    
    -- Recommendations
    recommendation TEXT,
    
    PRIMARY KEY (file_id, run_id)
);

-- ─────────────────────────────────────────────────────────────────────────────
-- TECHNOLOGY FILTERS (Custom Profiles)
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE custom_profiles (
    profile_id TEXT PRIMARY KEY,
    repo_id TEXT,  -- NULL for global profiles
    name TEXT NOT NULL,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    
    -- Profile definition
    base_profile TEXT,  -- Extend existing profile
    config_json TEXT NOT NULL
);
```

### 8.2 Vector Store Schema (Qdrant)

```python
# qdrant_schema.py

from qdrant_client.models import VectorParams, Distance

SEMANTIC_COLLECTION = "semantic_embeddings"

VECTOR_PARAMS = VectorParams(
    size=256,  # Hybrid embedding dimension
    distance=Distance.COSINE
)

# Payload schema
PAYLOAD_SCHEMA = {
    "file_id": "integer",
    "run_id": "keyword",
    "repo_id": "keyword",
    "path": "text",
    "language": "keyword",
    "domain_id": "keyword",
    "domain_name": "keyword",
    "is_bridge": "bool",
    
    # For filtering
    "directory": "keyword",  # Top-level directory
    "extension": "keyword",
    
    # Metadata for display
    "class_names": "keyword[]",
    "top_tokens": "keyword[]"
}
```

---

## 9. Implementation Roadmap

### 9.1 Phase Overview

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                      IMPLEMENTATION PHASES                                   │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  PHASE 1: Foundation (Weeks 1-3)                                            │
│  ═══════════════════════════════                                            │
│  □ AST parsing infrastructure (Tree-sitter multi-lang)                      │
│  □ Token extraction pipeline                                                │
│  □ Basic TF-IDF embeddings                                                  │
│  □ Technology filter framework + .NET profile                               │
│  □ Storage layer (SQLite schema)                                            │
│                                                                             │
│  PHASE 2: Clustering Core (Weeks 4-6)                                       │
│  ═══════════════════════════════════                                        │
│  □ HDBSCAN clustering implementation                                        │
│  □ Domain auto-naming algorithm                                             │
│  □ Multi-domain entity detection                                            │
│  □ API endpoints (basic)                                                    │
│  □ CLI commands                                                             │
│                                                                             │
│  PHASE 3: Enhanced Embeddings (Weeks 7-9)                                   │
│  ════════════════════════════════════════                                   │
│  □ Word2Vec training on codebase                                            │
│  □ Hybrid embedding pipeline                                                │
│  □ Qdrant vector storage integration                                        │
│  □ Similarity search API                                                    │
│  □ Additional tech profiles (React, Spring)                                 │
│                                                                             │
│  PHASE 4: Visualization & UI (Weeks 10-12)                                  │
│  ═════════════════════════════════════════                                  │
│  □ Domain graph visualization (D3.js)                                       │
│  □ 2D projection view (UMAP)                                               │
│  □ Domain explorer panel                                                    │
│  □ Similarity panel                                                         │
│  □ Integration with existing LFCA views                                     │
│                                                                             │
│  PHASE 5: Advanced Features (Weeks 13-16)                                   │
│  ════════════════════════════════════════                                   │
│  □ CodeBERT embeddings (optional GPU)                                       │
│  □ Natural language queries                                                 │
│  □ Hierarchical domain discovery                                            │
│  □ Domain drift detection                                                   │
│  □ CI integration (domain boundary checks)                                  │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 9.2 Detailed Phase 1 Tasks

```
PHASE 1: Foundation (Weeks 1-3)
══════════════════════════════

Week 1: Parsing Infrastructure
──────────────────────────────
□ Set up Tree-sitter with Python, C#, TypeScript, Java grammars
□ Implement BaseParser interface in lfca/semantic/parsing/base.py
□ Create TreeSitterParser generic implementation
□ Write token extraction for class names, methods, properties
□ Add CamelCase/snake_case splitter utility
□ Unit tests for each language parser

Week 2: Token Processing
────────────────────────
□ Implement TokenExtractor service
□ Add lemmatization using spaCy
□ Create TechFilter framework
□ Build .NET technology profile (YAML config)
□ Implement generic programming stopwords list
□ Add token enrichment (synonyms, abbreviations)
□ Integration tests for extraction pipeline

Week 3: Storage & Embeddings
────────────────────────────
□ Create SQLite schema for semantic data
□ Implement TokenStore for persistence
□ Build TF-IDF embedder with LSA dimensionality reduction
□ Add embedding caching layer
□ Create SemanticAnalyzer orchestration service
□ CLI command: lfca semantic analyze
□ End-to-end test on sample repository
```

### 9.3 Milestones

| Milestone | Description | Target Date |
|-----------|-------------|-------------|
| **M1: Parser Ready** | Multi-language AST parsing working | Week 1 |
| **M2: Tokens Extracted** | Full extraction pipeline with filtering | Week 2 |
| **M3: First Clusters** | HDBSCAN producing domain clusters | Week 5 |
| **M4: API Live** | REST API for domain discovery | Week 6 |
| **M5: Similarity Search** | Vector-based similarity working | Week 9 |
| **M6: UI Complete** | Full visualization in frontend | Week 12 |
| **M7: Production Ready** | All features, tests, documentation | Week 16 |

---

## 10. Success Metrics

### 10.1 Quality Metrics

| Metric | Target | Measurement |
|--------|--------|-------------|
| **Domain Coherence** | >0.75 avg | Silhouette score on embeddings |
| **Classification Accuracy** | >85% | Manual validation on labeled sample |
| **Naming Quality** | >70% acceptable | User survey on auto-generated names |
| **Tech Filter Precision** | >95% | Manual review of filtered tokens |

### 10.2 Performance Metrics

| Metric | Target | Scenario |
|--------|--------|----------|
| **Analysis Time** | <5 min | 10K files, hybrid embedding |
| **Similarity Query** | <100ms | Single file, top-20 results |
| **Classification** | <50ms | Single file |
| **Domain Discovery** | <30s | From cached embeddings |

### 10.3 User Value Metrics

| Metric | Target | Measurement |
|--------|--------|-------------|
| **Domain Discovery Adoption** | 60% of users | Usage analytics |
| **Time to Understand Codebase** | -40% | User survey |
| **Refactoring Confidence** | +35% | Developer feedback |
| **Documentation Generated** | 80% of repos | Auto-doc generation |

---

## 11. Appendix

### 11.1 Sample Output: Domain Discovery

```json
{
  "run_id": "sem_20260206_abc123",
  "created_at": "2026-02-06T10:30:00Z",
  "stats": {
    "files_analyzed": 847,
    "tokens_extracted": 34521,
    "domains_found": 8,
    "outlier_files": 23
  },
  "domains": [
    {
      "domain_id": "dom_001",
      "name": "Payment",
      "keywords": ["payment", "charge", "refund", "invoice", "transaction"],
      "file_count": 45,
      "cohesion_score": 0.89,
      "isolation_score": 0.76,
      "subdomains": [
        {
          "domain_id": "dom_001_a",
          "name": "Refund",
          "keywords": ["refund", "reversal", "chargeback"],
          "file_count": 12
        }
      ]
    },
    {
      "domain_id": "dom_002",
      "name": "Authentication",
      "keywords": ["auth", "login", "session", "token", "permission"],
      "file_count": 32,
      "cohesion_score": 0.92,
      "isolation_score": 0.88
    },
    {
      "domain_id": "dom_003",
      "name": "Order",
      "keywords": ["order", "cart", "checkout", "shipping", "item"],
      "file_count": 67,
      "cohesion_score": 0.84,
      "isolation_score": 0.71
    }
  ]
}
```

### 11.2 Sample Output: Classification

```json
{
  "path": "src/Services/OrderPaymentService.cs",
  "primary_domain": {
    "domain_id": "dom_003",
    "name": "Order",
    "affinity": 0.67
  },
  "secondary_domains": [
    {
      "domain_id": "dom_001",
      "name": "Payment",
      "affinity": 0.58
    }
  ],
  "confidence": 0.74,
  "is_outlier": false,
  "reasoning": [
    "Class name contains 'Order' (primary domain keyword)",
    "Class name contains 'Payment' (secondary domain keyword)",
    "Methods reference both order processing and payment handling",
    "Classified as integration point between Order and Payment domains"
  ]
}
```

### 11.3 References

| Resource | Description |
|----------|-------------|
| [Tree-sitter](https://tree-sitter.github.io/) | Multi-language AST parsing |
| [HDBSCAN](https://hdbscan.readthedocs.io/) | Density-based clustering |
| [CodeBERT](https://github.com/microsoft/CodeBERT) | Pre-trained code embeddings |
| [Qdrant](https://qdrant.tech/) | Vector similarity search |
| [spaCy](https://spacy.io/) | Industrial NLP processing |
| [Domain-Driven Design](https://domainlanguage.com/) | Bounded context concepts |

---

*Document Version: 1.0 | Created: February 6, 2026 | Author: LFCA Development Team*
