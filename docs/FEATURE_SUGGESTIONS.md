# LFCA Feature Suggestions
> **Created**: February 1, 2026  
> **Based on**: Research analysis + Industry trends + Academic foundations  
> **Focus**: Business value, implementation feasibility, and competitive differentiation

---

## Executive Summary

This document presents prioritized feature suggestions for LFCA based on:
1. **Research findings** from academic literature on change coupling, temporal analysis, and software evolution mining
2. **Competitive analysis** of tools like CodeScene, Understand, PyDriller, and Hercules
3. **Industry gaps** identified in open-source tooling
4. **LFCA's unique positioning** as a full-stack coupling analyzer with visualization

### Priority Legend
| Priority | Definition | Implementation Effort |
|----------|------------|----------------------|
| ⭐ **Top** | Game-changing feature, major competitive advantage | 3-6 weeks |
| 🔴 **Critical** | High business value, addresses core user needs | 1-2 weeks |
| 🟠 **High** | Significant differentiation, strong user demand | 2-4 weeks |
| 🟡 **Medium** | Nice-to-have, enhances user experience | 1-3 weeks |
| 🟢 **Low** | Future consideration, limited immediate impact | Variable |

---

## 1. Language Server Integration (Structural + Logical Coupling Fusion)

### Priority: ⭐ TOP PRIORITY

### Description
Integrate with **Language Server Protocol (LSP)** implementations like **Roslyn (.NET)**, **Pylance (Python)**, **TypeScript Language Server**, and **rust-analyzer** to extract **structural dependencies** (imports, call graphs, type references, usages) and **combine them with git-based logical coupling** for comprehensive dependency intelligence.

This creates a **fusion analysis** that answers questions neither approach can answer alone:
- **Structural only**: "File A imports File B" (but do they actually change together?)
- **Logical only**: "File A and B change together" (but why? what's the connection?)
- **Fusion**: "File A imports File B, they change together 85% of the time, and the coupling is through the `AuthService.Login()` method"

### Business Value

| Value Proposition | Impact |
|-------------------|--------|
| **Complete Dependency Picture** | Combines "what code says" with "what developers do" - structural + behavioral |
| **Explains Coupling** | Not just "these files couple" but "they couple because of this import/call" |
| **Finds Hidden Issues** | Structural dependency exists but no co-change = potential missing test coverage |
| **Cross-Language Support** | Unified analysis across polyglot codebases (.NET + JS + Python) |
| **Refactoring Confidence** | Know exactly what will break when you change a method signature |
| **Architecture Validation** | Verify that intended layers/modules match actual code dependencies |

### The Power of Fusion Analysis

```
┌─────────────────────────────────────────────────────────────────────┐
│                    COUPLING QUADRANT ANALYSIS                        │
├─────────────────────────────────────────────────────────────────────┤
│                                                                      │
│  Structural Coupling                                                 │
│       ↑                                                              │
│       │                                                              │
│  High │  EXPECTED COUPLING     │  OVER-ENGINEERED                   │
│       │  ✅ Import + Co-change │  ⚠️ Import but never co-change     │
│       │  (Healthy dependency)  │  (Dead code? Over-abstraction?)    │
│       │                        │                                     │
│       ├────────────────────────┼────────────────────────────────────│
│       │                        │                                     │
│  Low  │  INDEPENDENT           │  HIDDEN COUPLING                   │
│       │  ✅ No import, no      │  🔥 No import but co-change!       │
│       │     co-change          │  (Shared config? Copy-paste?       │
│       │  (Properly decoupled)  │   Implicit dependency?)            │
│       │                        │                                     │
│       └────────────────────────┴────────────────────────────────────→
│                Low                           High                    │
│                         Logical Coupling (Git)                       │
└─────────────────────────────────────────────────────────────────────┘
```

### Supported Language Servers

| Language | Server | Capabilities |
|----------|--------|--------------|
| **.NET (C#/F#)** | Roslyn / OmniSharp | Imports, namespaces, type references, call hierarchy, symbol usages |
| **Python** | Pylance / Pyright | Imports, type hints, function calls, class inheritance |
| **TypeScript/JavaScript** | tsserver | Imports, exports, call graphs, type references |
| **Java** | Eclipse JDT LS | Imports, class hierarchy, method calls |
| **Rust** | rust-analyzer | Crate dependencies, trait implementations, call graphs |
| **Go** | gopls | Package imports, interface implementations |

### Architecture Overview

```
┌─────────────────────────────────────────────────────────────────────┐
│                         LFCA Backend                                 │
├─────────────────────────────────────────────────────────────────────┤
│                                                                      │
│  ┌─────────────────┐     ┌─────────────────┐     ┌────────────────┐ │
│  │  Git Analyzer   │     │ Language Server │     │ Fusion Engine  │ │
│  │  (Existing)     │     │ Adapter Layer   │     │                │ │
│  │                 │     │                 │     │                │ │
│  │ • Commits       │     │ • LSP Client    │     │ • Combine data │ │
│  │ • Co-changes    │     │ • Roslyn Plugin │     │ • Quadrant     │ │
│  │ • Jaccard       │     │ • Pylance Plugin│     │   analysis     │ │
│  │ • Temporal      │     │ • TS Plugin     │     │ • Explain why  │ │
│  └────────┬────────┘     └────────┬────────┘     └────────┬───────┘ │
│           │                       │                       │         │
│           └───────────────────────┴───────────────────────┘         │
│                                   │                                  │
│                        ┌──────────▼──────────┐                      │
│                        │   Unified API       │                      │
│                        │   /coupling/fusion  │                      │
│                        └──────────┬──────────┘                      │
│                                   │                                  │
└───────────────────────────────────┼──────────────────────────────────┘
                                    │
┌───────────────────────────────────▼──────────────────────────────────┐
│                         LFCA Frontend                                │
├──────────────────────────────────────────────────────────────────────┤
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐  ┌──────────┐ │
│  │ Dependency   │  │ Coupling     │  │ Symbol       │  │ Impact   │ │
│  │ Graph View   │  │ Explanation  │  │ Usage View   │  │ Analysis │ │
│  │              │  │ Panel        │  │              │  │ Screen   │ │
│  └──────────────┘  └──────────────┘  └──────────────┘  └──────────┘ │
└──────────────────────────────────────────────────────────────────────┘
```

---

### Language Server Adapter API (Pseudo-Language Definition)

```typescript
/**
 * LFCA Language Server Adapter Interface
 * 
 * Implement this interface to add support for a new language.
 * Each adapter communicates with a language server via LSP or native API.
 */

interface LanguageServerAdapter {
  /** Unique identifier for this language */
  languageId: string;  // e.g., "csharp", "python", "typescript"
  
  /** File extensions this adapter handles */
  fileExtensions: string[];  // e.g., [".cs", ".csx"]
  
  /** Initialize the language server for a workspace */
  initialize(workspacePath: string): Promise<void>;
  
  /** Shutdown the language server */
  shutdown(): Promise<void>;
  
  /** Get all dependencies for a file (what this file imports/uses) */
  getDependencies(filePath: string): Promise<FileDependency[]>;
  
  /** Get all dependents of a file (what files use this file) */
  getDependents(filePath: string): Promise<FileDependency[]>;
  
  /** Get symbol definitions in a file */
  getSymbols(filePath: string): Promise<SymbolInfo[]>;
  
  /** Get all usages/references of a symbol */
  getSymbolUsages(symbol: SymbolIdentifier): Promise<SymbolUsage[]>;
  
  /** Get call hierarchy for a function/method */
  getCallHierarchy(symbol: SymbolIdentifier): Promise<CallHierarchyItem[]>;
  
  /** Get type hierarchy (inheritance) for a class/interface */
  getTypeHierarchy(symbol: SymbolIdentifier): Promise<TypeHierarchyItem[]>;
  
  /** Analyze entire workspace and return dependency graph */
  analyzeWorkspace(): Promise<WorkspaceAnalysis>;
}

// ============================================================
// Data Types
// ============================================================

interface FileDependency {
  /** Source file path */
  sourceFile: string;
  
  /** Target file path */
  targetFile: string;
  
  /** Type of dependency */
  dependencyType: DependencyType;
  
  /** Specific symbols involved in this dependency */
  symbols: DependencySymbol[];
  
  /** Strength score (0-1) based on number of usages */
  strength: number;
}

enum DependencyType {
  IMPORT = "import",           // Direct import/using statement
  INHERITANCE = "inheritance", // Class extends/implements
  CALL = "call",               // Function/method call
  TYPE_REFERENCE = "type_ref", // Type used in signature/variable
  INSTANTIATION = "instance",  // new ClassName()
  CONFIGURATION = "config",    // Config file reference
}

interface DependencySymbol {
  /** Symbol name */
  name: string;
  
  /** Symbol kind */
  kind: SymbolKind;
  
  /** Fully qualified name */
  qualifiedName: string;
  
  /** Location in source file */
  location: SourceLocation;
  
  /** Number of usages */
  usageCount: number;
}

enum SymbolKind {
  CLASS = "class",
  INTERFACE = "interface",
  FUNCTION = "function",
  METHOD = "method",
  PROPERTY = "property",
  VARIABLE = "variable",
  CONSTANT = "constant",
  ENUM = "enum",
  NAMESPACE = "namespace",
  MODULE = "module",
}

interface SymbolInfo {
  name: string;
  kind: SymbolKind;
  qualifiedName: string;
  location: SourceLocation;
  visibility: "public" | "private" | "protected" | "internal";
  documentation?: string;
}

interface SymbolUsage {
  /** File where symbol is used */
  filePath: string;
  
  /** Location of usage */
  location: SourceLocation;
  
  /** Context of usage */
  usageKind: "read" | "write" | "call" | "type" | "extend" | "implement";
  
  /** Containing symbol (function/class that contains this usage) */
  containingSymbol?: string;
}

interface CallHierarchyItem {
  symbol: SymbolInfo;
  
  /** Functions that call this one */
  callers: CallHierarchyItem[];
  
  /** Functions that this one calls */
  callees: CallHierarchyItem[];
}

interface TypeHierarchyItem {
  symbol: SymbolInfo;
  
  /** Parent types (extends/implements) */
  parents: TypeHierarchyItem[];
  
  /** Child types (classes that extend this) */
  children: TypeHierarchyItem[];
}

interface SourceLocation {
  filePath: string;
  startLine: number;
  startColumn: number;
  endLine: number;
  endColumn: number;
}

interface WorkspaceAnalysis {
  /** Total files analyzed */
  fileCount: number;
  
  /** Total symbols found */
  symbolCount: number;
  
  /** File-to-file dependency edges */
  dependencies: FileDependency[];
  
  /** Module/namespace groupings */
  modules: ModuleInfo[];
  
  /** Analysis timestamp */
  analyzedAt: string;
  
  /** Language server version */
  serverVersion: string;
}

interface ModuleInfo {
  name: string;
  files: string[];
  exportedSymbols: SymbolInfo[];
  dependencies: string[];  // Other module names
}
```

---

### Fusion Analysis API

```typescript
/**
 * LFCA Fusion Analysis API
 * Combines structural (LSP) and logical (Git) coupling data
 */

// ============================================================
// API Endpoints
// ============================================================

/**
 * GET /repos/{repo_id}/coupling/fusion
 * 
 * Get comprehensive coupling analysis combining structural and logical data
 */
interface FusionCouplingRequest {
  /** File to analyze */
  path: string;
  
  /** Include structural dependencies from language server */
  includeStructural?: boolean;  // default: true
  
  /** Include logical coupling from git history */
  includeLogical?: boolean;  // default: true
  
  /** Minimum coupling strength to include */
  minStrength?: number;  // default: 0.1
  
  /** Maximum results */
  limit?: number;  // default: 50
}

interface FusionCouplingResponse {
  /** Source file */
  sourceFile: string;
  
  /** Combined coupling results */
  couplings: FusionCouplingEdge[];
  
  /** Summary statistics */
  summary: FusionSummary;
  
  /** Insights and recommendations */
  insights: FusionInsight[];
}

interface FusionCouplingEdge {
  /** Target file */
  targetFile: string;
  
  /** Structural coupling data (from language server) */
  structural: {
    exists: boolean;
    dependencyTypes: DependencyType[];
    symbols: DependencySymbol[];
    strength: number;  // 0-1 based on usage count
  };
  
  /** Logical coupling data (from git history) */
  logical: {
    exists: boolean;
    jaccard: number;
    pDstGivenSrc: number;
    pSrcGivenDst: number;
    pairCount: number;
  };
  
  /** Combined analysis */
  fusion: {
    /** Overall coupling strength (weighted combination) */
    combinedStrength: number;
    
    /** Quadrant classification */
    quadrant: CouplingQuadrant;
    
    /** Explanation of the coupling */
    explanation: string;
    
    /** Confidence in the analysis */
    confidence: number;
  };
}

enum CouplingQuadrant {
  /** High structural + High logical = Expected, healthy dependency */
  EXPECTED = "expected",
  
  /** High structural + Low logical = Potential dead code or over-abstraction */
  OVER_ENGINEERED = "over_engineered",
  
  /** Low structural + High logical = Hidden coupling, investigate! */
  HIDDEN_COUPLING = "hidden_coupling",
  
  /** Low structural + Low logical = Independent, properly decoupled */
  INDEPENDENT = "independent",
}

interface FusionSummary {
  totalCouplings: number;
  structuralOnly: number;
  logicalOnly: number;
  bothTypes: number;
  
  byQuadrant: {
    expected: number;
    overEngineered: number;
    hiddenCoupling: number;
    independent: number;
  };
}

interface FusionInsight {
  type: InsightType;
  severity: "info" | "warning" | "critical";
  title: string;
  description: string;
  affectedFiles: string[];
  recommendation?: string;
}

enum InsightType {
  HIDDEN_DEPENDENCY = "hidden_dependency",
  DEAD_CODE_SUSPECT = "dead_code_suspect",
  MISSING_TEST = "missing_test",
  CIRCULAR_DEPENDENCY = "circular_dependency",
  LAYER_VIOLATION = "layer_violation",
  TIGHT_COUPLING = "tight_coupling",
}

// ============================================================
// Symbol-Level Coupling API
// ============================================================

/**
 * GET /repos/{repo_id}/symbols/{symbol_id}/coupling
 * 
 * Get coupling analysis at the symbol (function/class) level
 */
interface SymbolCouplingResponse {
  symbol: SymbolInfo;
  
  /** Files that use this symbol */
  usedBy: {
    file: string;
    usageCount: number;
    logicalCoupling: number;  // Git-based co-change with symbol's file
  }[];
  
  /** Symbols this symbol depends on */
  dependsOn: {
    symbol: SymbolInfo;
    dependencyType: DependencyType;
  }[];
  
  /** Change history of this symbol */
  changeHistory: {
    commitHash: string;
    date: string;
    author: string;
    coChangedSymbols: string[];  // Other symbols changed in same commit
  }[];
}

// ============================================================
// Impact Analysis API
// ============================================================

/**
 * POST /repos/{repo_id}/impact/analyze
 * 
 * Analyze the impact of changing specific symbols or files
 */
interface ImpactAnalysisRequest {
  /** Files or symbols to analyze */
  targets: ImpactTarget[];
  
  /** Analysis depth (how many levels of dependencies to follow) */
  depth?: number;  // default: 2
  
  /** Include test files in analysis */
  includeTests?: boolean;  // default: true
}

interface ImpactTarget {
  type: "file" | "symbol";
  path: string;
  symbolName?: string;  // Required if type is "symbol"
}

interface ImpactAnalysisResponse {
  /** Original targets */
  targets: ImpactTarget[];
  
  /** Direct impacts (1st level) */
  directImpacts: ImpactedItem[];
  
  /** Transitive impacts (2nd+ level) */
  transitiveImpacts: ImpactedItem[];
  
  /** Test files that should be run */
  affectedTests: string[];
  
  /** Risk assessment */
  riskAssessment: {
    score: number;  // 0-100
    level: "low" | "medium" | "high" | "critical";
    factors: string[];
  };
  
  /** Summary */
  summary: {
    totalAffectedFiles: number;
    totalAffectedSymbols: number;
    estimatedTestScope: number;
  };
}

interface ImpactedItem {
  type: "file" | "symbol";
  path: string;
  symbolName?: string;
  
  /** Why this item is impacted */
  impactReason: {
    structural: string[];  // e.g., ["imports AuthService", "calls Login()"]
    logical: string[];     // e.g., ["co-changes 85% of the time"]
  };
  
  /** Confidence that this will need changes */
  probability: number;
  
  /** Distance from original target */
  depth: number;
}
```

---

### UI Screens & Components

#### Screen 1: Dependency Explorer (Main View)

```
┌─────────────────────────────────────────────────────────────────────────────┐
│  LFCA > openhands > Dependency Explorer                          [⚙️] [📤]  │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  ┌─────────────────────────────────────────────────────────────────────────┐│
│  │ Selected File: src/auth/login_service.py                    [🔍 Search] ││
│  └─────────────────────────────────────────────────────────────────────────┘│
│                                                                              │
│  ┌─────────────────────────┐  ┌────────────────────────────────────────────┐│
│  │ COUPLING QUADRANT       │  │ DEPENDENCY GRAPH                           ││
│  │                         │  │                                            ││
│  │  Structural ↑           │  │        ┌─────────┐                        ││
│  │      │   [3] │ [2]      │  │        │ config  │                        ││
│  │  Hi  │ Over- │ Expected │  │        │ .yaml   │                        ││
│  │      │ eng.  │ ✓        │  │        └────┬────┘                        ││
│  │  ────┼───────┼──────    │  │             │ config                      ││
│  │      │   [0] │ [5] 🔥   │  │     ┌───────▼───────┐                     ││
│  │  Lo  │ Indep │ Hidden!  │  │     │ login_service │ ◄── YOU ARE HERE    ││
│  │      │       │          │  │     └───┬───┬───┬───┘                     ││
│  │      └───────┴──────→   │  │         │   │   │                         ││
│  │        Lo       Hi      │  │    import│call│  │type                    ││
│  │        Logical          │  │         │   │   │                         ││
│  │                         │  │    ┌────▼┐ ┌▼──┐ ┌▼────┐                  ││
│  │  [🔥] = Needs attention │  │    │user │ │jwt│ │sess │                  ││
│  └─────────────────────────┘  │    │_repo│ │lib│ │_mgr │                  ││
│                               │    └─────┘ └───┘ └─────┘                  ││
│                               └────────────────────────────────────────────┘│
│                                                                              │
│  ┌─────────────────────────────────────────────────────────────────────────┐│
│  │ COUPLING DETAILS                                              [Git][LSP]││
│  ├──────────────────┬──────────┬──────────┬──────────┬──────────┬─────────┤│
│  │ File             │ Struct.  │ Logical  │ Combined │ Quadrant │ Symbols ││
│  ├──────────────────┼──────────┼──────────┼──────────┼──────────┼─────────┤│
│  │ session_manager  │ 0.85     │ 0.89     │ 0.87     │ Expected │ 4       ││
│  │ user_repository  │ 0.72     │ 0.45     │ 0.58     │ Over-eng │ 2       ││
│  │ jwt_utils.py     │ 0.90     │ 0.82     │ 0.86     │ Expected │ 3       ││
│  │ billing_service  │ 0.05     │ 0.78     │ 0.42     │ 🔥Hidden │ 0       ││
│  │ config.yaml      │ 0.30     │ 0.65     │ 0.48     │ Hidden   │ 1       ││
│  └──────────────────┴──────────┴──────────┴──────────┴──────────┴─────────┘│
│                                                                              │
│  ┌─────────────────────────────────────────────────────────────────────────┐│
│  │ 💡 INSIGHTS                                                             ││
│  │ ⚠️ Hidden coupling detected: billing_service.py has no import but      ││
│  │    co-changes 78% of the time. Investigate shared configuration or     ││
│  │    implicit dependency.                                                 ││
│  │ ✅ Expected couplings look healthy: jwt_utils and session_manager      ││
│  │    are properly coupled via direct imports.                            ││
│  └─────────────────────────────────────────────────────────────────────────┘│
└─────────────────────────────────────────────────────────────────────────────┘
```

#### Screen 2: Symbol Usage View

```
┌─────────────────────────────────────────────────────────────────────────────┐
│  LFCA > openhands > Symbol: AuthService.Login()                   [⚙️] [📤] │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  ┌─ Symbol Info ────────────────────────────────────────────────────────────┐
│  │ Name: Login                                                              │
│  │ Type: Method (public)                                                    │
│  │ File: src/auth/auth_service.py:45                                        │
│  │ Signature: def Login(username: str, password: str) -> AuthResult         │
│  └──────────────────────────────────────────────────────────────────────────┘
│                                                                              │
│  ┌─ Usages (12 total) ───────────────────────────────────────────── [🔍] ──┐
│  │                                                                          │
│  │  📁 src/api/auth_handler.py                                             │
│  │     └─ Line 34: result = auth_service.Login(req.username, req.password) │
│  │     └─ Line 78: if auth_service.Login(...):                             │
│  │                                                                          │
│  │  📁 src/api/oauth_handler.py                                            │
│  │     └─ Line 56: self.auth.Login(oauth_user, temp_password)              │
│  │                                                                          │
│  │  📁 tests/test_auth.py                                                  │
│  │     └─ Line 23: assert service.Login("user", "pass").success            │
│  │     └─ Line 45: service.Login("invalid", "creds")                       │
│  │     └─ Line 67: mock_login = service.Login                              │
│  │                                                                          │
│  └──────────────────────────────────────────────────────────────────────────┘
│                                                                              │
│  ┌─ Change History (Symbol Level) ─────────────────────────────────────────┐
│  │ Date       │ Author      │ Co-changed Methods                          │
│  │ 2026-01-28 │ alice@      │ Logout(), RefreshToken()                    │
│  │ 2026-01-15 │ bob@        │ Login() only (bug fix)                      │
│  │ 2025-12-20 │ alice@      │ Login(), ValidateCredentials(), HashPwd()  │
│  └──────────────────────────────────────────────────────────────────────────┘
│                                                                              │
│  ┌─ Impact if Changed ─────────────────────────────────────────────────────┐
│  │ 🎯 Direct Impact: 4 files (auth_handler, oauth_handler, 2 tests)        │
│  │ 🔗 Transitive: 8 files (API layer, integration tests)                   │
│  │ ⚠️ Risk: MEDIUM - 12 usages across 6 files                              │
│  │                                                                          │
│  │ [🔍 Full Impact Analysis]  [📋 Copy Affected Files]                     │
│  └──────────────────────────────────────────────────────────────────────────┘
└─────────────────────────────────────────────────────────────────────────────┘
```

#### Screen 3: Impact Analysis Wizard

```
┌─────────────────────────────────────────────────────────────────────────────┐
│  LFCA > openhands > Impact Analysis                               [⚙️] [📤] │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  ┌─ What are you planning to change? ───────────────────────────────────────┐
│  │                                                                          │
│  │  [x] File: src/auth/auth_service.py                                     │
│  │  [x] Symbol: AuthService.Login (method)                                 │
│  │  [ ] File: _________________________________ [+ Add More]               │
│  │                                                                          │
│  │  Analysis Depth: [2 levels ▼]    [🔍 Analyze Impact]                    │
│  └──────────────────────────────────────────────────────────────────────────┘
│                                                                              │
│  ┌─ Impact Results ─────────────────────────────────────────────────────────┐
│  │                                                                          │
│  │  📊 RISK SCORE: 67/100 (MEDIUM-HIGH)                                    │
│  │  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━░░░░░░░░░░░░░░░░░░          │
│  │                                                                          │
│  │  Risk Factors:                                                           │
│  │  • High usage count (12 direct usages)                                  │
│  │  • Cross-module impact (auth → api → tests)                             │
│  │  • 3 hidden couplings detected (no import but co-change)               │
│  │                                                                          │
│  ├──────────────────────────────────────────────────────────────────────────┤
│  │                                                                          │
│  │  ┌─ Direct Impacts (Level 1) ───────────────────── 6 files ────────────┐│
│  │  │                                                                      ││
│  │  │  🔴 src/api/auth_handler.py                                         ││
│  │  │     Reason: Calls Login() at lines 34, 78                           ││
│  │  │     Probability: 95%                                                 ││
│  │  │                                                                      ││
│  │  │  🟠 src/api/oauth_handler.py                                        ││
│  │  │     Reason: Calls Login() at line 56                                ││
│  │  │     Probability: 85%                                                 ││
│  │  │                                                                      ││
│  │  │  🟡 src/billing/subscription.py                                     ││
│  │  │     Reason: 🔥 No import but co-changes 78% (hidden coupling!)      ││
│  │  │     Probability: 78%                                                 ││
│  │  │                                                                      ││
│  │  │  🟢 tests/test_auth.py                                              ││
│  │  │     Reason: Test file, 5 usages                                     ││
│  │  │     Probability: 100%                                                ││
│  │  └──────────────────────────────────────────────────────────────────────┘│
│  │                                                                          │
│  │  ┌─ Transitive Impacts (Level 2) ──────────────── 12 files ────────────┐│
│  │  │  src/api/middleware.py (via auth_handler)                           ││
│  │  │  src/api/routes.py (via auth_handler)                               ││
│  │  │  tests/integration/test_api.py (via auth_handler)                   ││
│  │  │  ... [Show 9 more]                                                  ││
│  │  └──────────────────────────────────────────────────────────────────────┘│
│  │                                                                          │
│  └──────────────────────────────────────────────────────────────────────────┘
│                                                                              │
│  ┌─ Recommendations ────────────────────────────────────────────────────────┐
│  │ 1. Investigate hidden coupling with billing/subscription.py             │
│  │ 2. Update tests in test_auth.py after changing Login()                  │
│  │ 3. Consider notifying API team (auth_handler, oauth_handler)            │
│  │ 4. Run integration tests: pytest tests/integration/ -k auth             │
│  └──────────────────────────────────────────────────────────────────────────┘
│                                                                              │
│  [📋 Export Report]  [📧 Notify Affected Owners]  [🔗 Create PR Checklist] │
└─────────────────────────────────────────────────────────────────────────────┘
```

#### Screen 4: Coupling Quadrant Dashboard

```
┌─────────────────────────────────────────────────────────────────────────────┐
│  LFCA > openhands > Coupling Health Dashboard                     [⚙️] [📤] │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  ┌─ Repository Health Score ────────────────────────────────────────────────┐
│  │                                                                          │
│  │   COUPLING HEALTH: 72/100 (Good)                                        │
│  │   ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━░░░░░░░░░░░░░         │
│  │                                                                          │
│  │   ✅ Expected Couplings: 234 (78%)                                       │
│  │   ⚠️ Over-engineered: 32 (11%)                                           │
│  │   🔥 Hidden Couplings: 28 (9%)  ← Needs attention!                       │
│  │   ✅ Independent: 156 file pairs analyzed                                │
│  └──────────────────────────────────────────────────────────────────────────┘
│                                                                              │
│  ┌─ Quadrant Visualization ─────────────────────────────────────────────────┐
│  │                                                                          │
│  │  Structural Coupling ↑                                                   │
│  │       │                                                                  │
│  │  1.0  │ ○ ○ ○ ○ ○ ○ │ ● ● ● ● ● ● ● ● ● ● ●                            │
│  │       │ ○ ○ ○ ○ ○   │ ● ● ● ● ● ● ● ● ● ● ● ●                          │
│  │  0.8  │ ○ ○ ○       │ ● ● ● ● ● ● ● ● ● ● ● ●                          │
│  │       │ ○ ○         │ ● ● ● ● ● ● ●                                     │
│  │  0.6  │ ○           │ ● ● ● ●                                           │
│  │       │─────────────┼─────────────────────────                          │
│  │  0.4  │             │ ◆ ◆ ◆                                             │
│  │       │             │ ◆ ◆ ◆ ◆ ◆                                         │
│  │  0.2  │             │ ◆ ◆ ◆ ◆ ◆ ◆ ◆ 🔥                                 │
│  │       │             │                                                    │
│  │  0.0  └─────────────┴────────────────────────→                          │
│  │       0.0    0.2    0.4    0.6    0.8    1.0                            │
│  │                   Logical Coupling                                       │
│  │                                                                          │
│  │  Legend: ● Expected  ○ Over-engineered  ◆ Hidden  🔥 Critical           │
│  └──────────────────────────────────────────────────────────────────────────┘
│                                                                              │
│  ┌─ Top Hidden Couplings (Investigate!) ────────────────────────────────────┐
│  │ │ Files                              │ Git Coupling │ Action            │
│  │ │ billing/sub.py ↔ auth/login.py    │ 78%          │ [Investigate]     │
│  │ │ config/db.yaml ↔ api/handlers.py  │ 72%          │ [Investigate]     │
│  │ │ utils/cache.py ↔ api/users.py     │ 68%          │ [Investigate]     │
│  └──────────────────────────────────────────────────────────────────────────┘
│                                                                              │
│  ┌─ Top Over-Engineered (Potential Dead Code) ──────────────────────────────┐
│  │ │ Files                              │ Struct.│ Logical │ Action        │
│  │ │ utils/deprecated_helper.py        │ 0.90   │ 0.05    │ [Review]      │
│  │ │ lib/old_validator.py              │ 0.85   │ 0.08    │ [Review]      │
│  └──────────────────────────────────────────────────────────────────────────┘
└─────────────────────────────────────────────────────────────────────────────┘
```

---

### Implementation Scenarios

#### Scenario 1: Developer Wants to Refactor a Method

```
User Story: As a developer, I want to know what will break if I change 
            the Login() method signature.

Flow:
1. User navigates to Symbol Search → types "Login"
2. System shows Login() method in auth_service.py
3. User clicks "Analyze Impact"
4. System queries:
   a) Language Server: Get all usages of Login() across codebase
   b) Git History: Get co-change patterns for auth_service.py
5. System fuses data and displays:
   - 12 direct usages (from LSP)
   - 3 hidden couplings (from Git - files that co-change but don't import)
   - Risk score: 67 (medium-high)
   - Recommended: Update 4 files, run 3 test suites
```

#### Scenario 2: Architecture Review - Finding Hidden Dependencies

```
User Story: As an architect, I want to find files that are coupled 
            in practice but not in code structure.

Flow:
1. User opens Coupling Health Dashboard
2. Views Quadrant Visualization
3. Clicks on "Hidden Couplings" section (bottom-right quadrant)
4. Sees list of file pairs with high git coupling but no imports:
   - billing/subscription.py ↔ auth/login.py (78% co-change, 0 imports)
5. User clicks "Investigate"
6. System shows:
   - Both files read from same config section
   - Both are modified in tickets labeled "auth-billing-integration"
   - Recommendation: Consider extracting shared logic or adding explicit import
```

#### Scenario 3: Onboarding - Understanding a File's Dependencies

```
User Story: As a new team member, I want to understand what a file 
            depends on and why.

Flow:
1. User browses to src/auth/login_service.py
2. Clicks "Dependency Explorer"
3. Sees visual graph showing:
   - Structural: imports jwt_utils, session_manager, user_repository
   - Logical: co-changes with billing_service (hidden!), config.yaml
4. Each edge shows:
   - Type (import, call, config, hidden)
   - Strength (how tightly coupled)
   - Specific symbols involved (Login() calls validate_session())
5. User hovers over billing_service edge:
   - "This file has no direct import but changes together 78% of the time.
      Common commit messages mention 'auth flow' and 'billing validation'."
```

#### Scenario 4: Code Review - Checking for Missing Changes

```
User Story: As a reviewer, I want to verify the PR includes all 
            necessary coupled files.

Flow:
1. PR contains changes to: auth_service.py, auth_handler.py
2. LFCA CI integration runs
3. System analyzes:
   - Structural: auth_service → jwt_utils, session_manager
   - Logical: auth_service co-changes with test_auth.py (72%)
4. System comments on PR:
   "⚠️ Missing files? Based on coupling analysis:
    - test_auth.py: co-changes 72% of the time (not in PR)
    - billing/subscription.py: hidden coupling detected (investigate)"
```

---

### Roslyn Adapter Implementation (Example for .NET)

```python
# lfca/adapters/roslyn_adapter.py
"""
Roslyn Language Server Adapter for C#/.NET projects
Uses OmniSharp or direct Roslyn APIs via subprocess
"""

import asyncio
import json
from pathlib import Path
from typing import List, Optional
from dataclasses import dataclass

from .base import LanguageServerAdapter, FileDependency, SymbolInfo, DependencyType


class RoslynAdapter(LanguageServerAdapter):
    """
    Adapter for .NET projects using Roslyn via OmniSharp
    """
    
    language_id = "csharp"
    file_extensions = [".cs", ".csx", ".vb"]
    
    def __init__(self):
        self.omnisharp_process = None
        self.workspace_path = None
        self._request_id = 0
    
    async def initialize(self, workspace_path: str) -> None:
        """Start OmniSharp language server"""
        self.workspace_path = workspace_path
        
        # Start OmniSharp process
        self.omnisharp_process = await asyncio.create_subprocess_exec(
            "omnisharp",
            "-s", workspace_path,
            "--hostPID", str(os.getpid()),
            "--encoding", "utf-8",
            "--loglevel", "warning",
            stdin=asyncio.subprocess.PIPE,
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.PIPE
        )
        
        # Wait for initialization
        await self._wait_for_ready()
    
    async def get_dependencies(self, file_path: str) -> List[FileDependency]:
        """Get all files that this file depends on (imports/uses)"""
        dependencies = []
        
        # Get using statements
        usings = await self._request("o#/v2/getcodestructure", {
            "FileName": file_path
        })
        
        # Get type references
        symbols = await self.get_symbols(file_path)
        
        for symbol in symbols:
            # Find definition locations for each referenced type
            refs = await self._request("o#/v2/findimplementations", {
                "FileName": file_path,
                "Line": symbol.location.start_line,
                "Column": symbol.location.start_column
            })
            
            for ref in refs.get("QuickFixes", []):
                target_file = ref.get("FileName")
                if target_file and target_file != file_path:
                    dependencies.append(FileDependency(
                        source_file=file_path,
                        target_file=target_file,
                        dependency_type=self._classify_dependency(symbol),
                        symbols=[DependencySymbol(
                            name=symbol.name,
                            kind=symbol.kind,
                            qualified_name=symbol.qualified_name,
                            location=symbol.location,
                            usage_count=1
                        )],
                        strength=0.0  # Will be calculated later
                    ))
        
        # Aggregate and calculate strength
        return self._aggregate_dependencies(dependencies)
    
    async def get_symbol_usages(self, symbol: SymbolIdentifier) -> List[SymbolUsage]:
        """Find all usages of a symbol across the workspace"""
        response = await self._request("o#/v2/findusages", {
            "FileName": symbol.file_path,
            "Line": symbol.line,
            "Column": symbol.column,
            "OnlyThisFile": False,
            "ExcludeDefinition": True
        })
        
        usages = []
        for quick_fix in response.get("QuickFixes", []):
            usages.append(SymbolUsage(
                file_path=quick_fix["FileName"],
                location=SourceLocation(
                    file_path=quick_fix["FileName"],
                    start_line=quick_fix["Line"],
                    start_column=quick_fix["Column"],
                    end_line=quick_fix["EndLine"],
                    end_column=quick_fix["EndColumn"]
                ),
                usage_kind=self._classify_usage_kind(quick_fix),
                containing_symbol=quick_fix.get("ContainingSymbol")
            ))
        
        return usages
    
    async def get_call_hierarchy(
        self, symbol: SymbolIdentifier
    ) -> CallHierarchyItem:
        """Get incoming and outgoing calls for a method"""
        
        # Get incoming calls (who calls this)
        incoming = await self._request("o#/v2/callhierarchy/incoming", {
            "FileName": symbol.file_path,
            "Line": symbol.line,
            "Column": symbol.column
        })
        
        # Get outgoing calls (what this calls)
        outgoing = await self._request("o#/v2/callhierarchy/outgoing", {
            "FileName": symbol.file_path,
            "Line": symbol.line,
            "Column": symbol.column
        })
        
        return CallHierarchyItem(
            symbol=await self._get_symbol_info(symbol),
            callers=self._parse_call_hierarchy(incoming),
            callees=self._parse_call_hierarchy(outgoing)
        )
    
    async def analyze_workspace(self) -> WorkspaceAnalysis:
        """Analyze entire workspace and build dependency graph"""
        
        # Get all C# files
        cs_files = list(Path(self.workspace_path).rglob("*.cs"))
        
        all_dependencies = []
        all_symbols = []
        modules = {}
        
        for cs_file in cs_files:
            # Get dependencies for each file
            deps = await self.get_dependencies(str(cs_file))
            all_dependencies.extend(deps)
            
            # Get symbols
            symbols = await self.get_symbols(str(cs_file))
            all_symbols.extend(symbols)
            
            # Group by namespace (module)
            for symbol in symbols:
                ns = symbol.qualified_name.rsplit(".", 1)[0] if "." in symbol.qualified_name else "global"
                if ns not in modules:
                    modules[ns] = {"files": set(), "symbols": []}
                modules[ns]["files"].add(str(cs_file))
                modules[ns]["symbols"].append(symbol)
        
        return WorkspaceAnalysis(
            file_count=len(cs_files),
            symbol_count=len(all_symbols),
            dependencies=all_dependencies,
            modules=[
                ModuleInfo(
                    name=name,
                    files=list(data["files"]),
                    exported_symbols=[s for s in data["symbols"] if s.visibility == "public"],
                    dependencies=[]  # Would need additional analysis
                )
                for name, data in modules.items()
            ],
            analyzed_at=datetime.now().isoformat(),
            server_version="OmniSharp"
        )
    
    # Helper methods
    async def _request(self, endpoint: str, params: dict) -> dict:
        """Send request to OmniSharp and get response"""
        self._request_id += 1
        request = {
            "seq": self._request_id,
            "type": "request",
            "command": endpoint,
            "arguments": params
        }
        
        self.omnisharp_process.stdin.write(
            (json.dumps(request) + "\n").encode()
        )
        await self.omnisharp_process.stdin.drain()
        
        # Read response
        response_line = await self.omnisharp_process.stdout.readline()
        return json.loads(response_line.decode())
    
    def _classify_dependency(self, symbol: SymbolInfo) -> DependencyType:
        """Classify the type of dependency based on symbol kind"""
        if symbol.kind in ["class", "interface"]:
            return DependencyType.INHERITANCE
        elif symbol.kind == "method":
            return DependencyType.CALL
        else:
            return DependencyType.TYPE_REFERENCE
```

---

### Database Schema Extensions

```sql
-- New tables for language server data

-- Structural dependencies from language servers
CREATE TABLE structural_dependencies (
    id INTEGER PRIMARY KEY,
    repo_id TEXT NOT NULL,
    source_file_id INTEGER NOT NULL,
    target_file_id INTEGER NOT NULL,
    dependency_type TEXT NOT NULL,  -- 'import', 'inheritance', 'call', etc.
    strength REAL DEFAULT 0.0,
    analyzed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    FOREIGN KEY (source_file_id) REFERENCES files(id),
    FOREIGN KEY (target_file_id) REFERENCES files(id)
);

-- Symbol definitions
CREATE TABLE symbols (
    id INTEGER PRIMARY KEY,
    repo_id TEXT NOT NULL,
    file_id INTEGER NOT NULL,
    name TEXT NOT NULL,
    kind TEXT NOT NULL,  -- 'class', 'method', 'function', etc.
    qualified_name TEXT NOT NULL,
    visibility TEXT,
    start_line INTEGER,
    start_column INTEGER,
    end_line INTEGER,
    end_column INTEGER,
    
    FOREIGN KEY (file_id) REFERENCES files(id)
);

-- Symbol usages (references)
CREATE TABLE symbol_usages (
    id INTEGER PRIMARY KEY,
    symbol_id INTEGER NOT NULL,
    file_id INTEGER NOT NULL,
    usage_kind TEXT NOT NULL,  -- 'read', 'write', 'call', 'extend'
    line INTEGER,
    column INTEGER,
    containing_symbol_id INTEGER,
    
    FOREIGN KEY (symbol_id) REFERENCES symbols(id),
    FOREIGN KEY (file_id) REFERENCES files(id),
    FOREIGN KEY (containing_symbol_id) REFERENCES symbols(id)
);

-- Dependency symbols (which symbols create a file-to-file dependency)
CREATE TABLE dependency_symbols (
    id INTEGER PRIMARY KEY,
    dependency_id INTEGER NOT NULL,
    symbol_id INTEGER NOT NULL,
    usage_count INTEGER DEFAULT 1,
    
    FOREIGN KEY (dependency_id) REFERENCES structural_dependencies(id),
    FOREIGN KEY (symbol_id) REFERENCES symbols(id)
);

-- Fusion analysis cache
CREATE TABLE fusion_coupling (
    id INTEGER PRIMARY KEY,
    repo_id TEXT NOT NULL,
    source_file_id INTEGER NOT NULL,
    target_file_id INTEGER NOT NULL,
    structural_strength REAL,
    logical_strength REAL,
    combined_strength REAL,
    quadrant TEXT,  -- 'expected', 'over_engineered', 'hidden_coupling', 'independent'
    explanation TEXT,
    analyzed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    FOREIGN KEY (source_file_id) REFERENCES files(id),
    FOREIGN KEY (target_file_id) REFERENCES files(id)
);

-- Indexes for performance
CREATE INDEX idx_structural_deps_source ON structural_dependencies(source_file_id);
CREATE INDEX idx_structural_deps_target ON structural_dependencies(target_file_id);
CREATE INDEX idx_symbols_file ON symbols(file_id);
CREATE INDEX idx_symbol_usages_symbol ON symbol_usages(symbol_id);
CREATE INDEX idx_fusion_source ON fusion_coupling(source_file_id);
```

---

### References

- Language Server Protocol Specification: https://microsoft.github.io/language-server-protocol/
- Roslyn (C#/.NET): https://github.com/dotnet/roslyn
- OmniSharp: https://github.com/OmniSharp/omnisharp-roslyn
- Pylance/Pyright: https://github.com/microsoft/pyright
- TypeScript Language Server: https://github.com/typescript-language-server/typescript-language-server
- rust-analyzer: https://rust-analyzer.github.io/

---

## 2. Hotspot Detection (Churn × Complexity Matrix)

### Priority: 🔴 Critical

### Description
Combine **change frequency (churn)** with **cyclomatic complexity** to identify high-risk files—those that change often AND are complex. Files in the "top-right quadrant" are prime refactoring targets.

### Business Value
- **Risk Reduction**: Identifies files most likely to introduce bugs (validated by research: high churn + high complexity = defect-prone)
- **Refactoring Prioritization**: Concrete, data-driven recommendations for where to focus engineering effort
- **Team Productivity**: Reduces time spent debugging by proactively addressing problematic code
- **Executive Reporting**: Clear visualization of technical debt for non-technical stakeholders

### Implementation Details
```
Metrics needed:
- Churn: commits touching file (already in transactions.parquet)
- Complexity: Extract from code analysis (new - use radon for Python, eslint-plugin-complexity for JS)

Classification zones:
┌─────────────────────────────────────────────┐
│ Complexity                                   │
│     ↑                                        │
│     │  REFACTOR    │    🔥 HOTSPOT           │
│     │  (complex,   │    (complex + churns)   │
│     │   stable)    │                         │
│  10 ├──────────────┼────────────────────────│
│     │  GREEN       │    CHURN-HEAVY          │
│     │  (simple,    │    (simple but changes  │
│     │   stable)    │    frequently)          │
│     └──────────────┴────────────────────────→
│         40              Churn (commits)      │
└─────────────────────────────────────────────┘
```

### API Design
```
GET /repos/{repo_id}/hotspots
Response: {
  "hotspots": [
    {
      "file": "src/api/handlers.py",
      "churn": 85,
      "complexity": 23,
      "zone": "HOTSPOT",
      "risk_score": 0.92,
      "recommendation": "Consider splitting into smaller modules"
    }
  ],
  "summary": {
    "total_files": 450,
    "hotspot_count": 12,
    "churn_heavy_count": 34,
    "refactor_candidates": 8
  }
}
```

### References
- Adam Tornhill's "Software Design X-Rays" methodology
- CodeScene's hotspot analysis (commercial reference)
- Research: Churnalizer, RubyCritic approaches

---

## 2. Change Impact Prediction

### Priority: 🔴 Critical

### Description
When a developer plans to modify a file, predict which other files will likely need changes based on historical co-change patterns. This is a natural extension of LFCA's coupling data.

### Business Value
- **Scope Estimation**: More accurate sprint planning by knowing true change radius
- **Bug Prevention**: Ensures related files aren't forgotten during changes
- **Code Review**: Reviewers can check if all coupled files were considered
- **Onboarding**: New developers understand ripple effects before making changes

### Implementation Details
Use existing coupling data (Jaccard, conditional probability) to compute:
1. **Direct impacts**: Files with high `p_dst_given_src` (>0.7)
2. **Transitive impacts**: Files coupled to direct impacts (2nd-degree)
3. **Test impacts**: Related test files that should be updated

```python
# Algorithm pseudocode
def predict_impact(file_path, depth=2, min_probability=0.5):
    impacts = []
    queue = [(file_path, 0)]
    visited = set()
    
    while queue:
        current, level = queue.pop(0)
        if level > depth or current in visited:
            continue
        visited.add(current)
        
        # Get coupled files from edges table
        coupled = get_coupled_files(current, min_probability)
        for dst, prob in coupled:
            impacts.append({
                "file": dst,
                "probability": prob,
                "impact_level": level + 1,
                "reason": "Historical co-change"
            })
            if level + 1 < depth:
                queue.append((dst, level + 1))
    
    return dedupe_and_rank(impacts)
```

### API Design
```
POST /repos/{repo_id}/impact/predict
Body: {
  "files": ["src/auth/login.py"],
  "depth": 2,
  "min_probability": 0.5
}

Response: {
  "planned_changes": ["src/auth/login.py"],
  "predicted_impacts": [
    {
      "file": "src/auth/session.py",
      "probability": 0.89,
      "impact_level": 1,
      "reason": "Changed together in 89% of login.py changes"
    },
    {
      "file": "tests/test_login.py",
      "probability": 0.72,
      "impact_level": 1,
      "reason": "Test file for modified source"
    }
  ],
  "estimated_scope": {
    "direct_files": 3,
    "transitive_files": 8,
    "test_files": 2,
    "total_impact_radius": 13
  }
}
```

---

## 3. Bus Factor & Knowledge Distribution

### Priority: 🟠 High

### Description
Calculate the "bus factor" (minimum number of developers who could leave before a project is at risk) and visualize knowledge distribution across the codebase.

### Business Value
- **Risk Management**: Identify single points of failure in team knowledge
- **Succession Planning**: Proactively address knowledge concentration before departures
- **Code Ownership**: Clear understanding of who knows what
- **Hiring Decisions**: Identify where knowledge gaps exist

### Implementation Details
Extract author data from commits to compute:
1. **Degree of Authorship (DOA)**: Weighted contribution score per file
2. **Knowledge coverage**: Which files each developer understands
3. **Bus factor per module**: How many developers know each area

```python
# DOA calculation (simplified)
def calculate_doa(file_path, author, commits):
    first_author_bonus = 0.25 if is_first_author(file_path, author) else 0
    
    author_changes = count_changes(file_path, author, commits)
    total_changes = count_total_changes(file_path, commits)
    
    recency_weight = calculate_recency_decay(author_changes)
    
    return first_author_bonus + (1 - first_author_bonus) * (
        author_changes / total_changes
    ) * recency_weight
```

### API Design
```
GET /repos/{repo_id}/knowledge/distribution

Response: {
  "bus_factor": {
    "overall": 2,
    "by_module": {
      "src/auth/": 3,
      "src/billing/": 1,  // Risk!
      "src/api/": 4
    }
  },
  "knowledge_silos": [
    {
      "module": "src/billing/",
      "primary_owner": "alice@example.com",
      "ownership_percentage": 94,
      "risk_level": "critical"
    }
  ],
  "experts_by_area": {
    "src/auth/": [
      {"author": "bob@example.com", "score": 0.85},
      {"author": "carol@example.com", "score": 0.62}
    ]
  }
}
```

### Visualization
Add a heatmap view showing knowledge coverage:
- X-axis: Modules/folders
- Y-axis: Developers
- Color intensity: Knowledge score (DOA)

---

## 4. Temporal Coupling Detection

### Priority: 🟠 High

### Description
Detect files that change within configurable time windows (not just same commit). This captures dependencies across commits made hours or days apart.

### Business Value
- **Hidden Dependencies**: Finds coupling missed by commit-level analysis
- **Distributed Teams**: Captures patterns across time zones
- **Microservices**: Detects cross-repository dependencies
- **Build Feedback**: Captures "fix-after-break" patterns

### Implementation Details
```
Parameters:
- coupling-min-activity-gap-minutes: 120 (group commits within 2 hours as "burst")
- coupling-time-overlap-minutes: 60 (expand window by ±60 min)
- coupling-min-ratio: 0.75 (filter weak couplings)

Algorithm:
1. Group each file's commits into "bursts" (commits within gap threshold)
2. Expand each burst window by overlap parameter
3. Count how often other files appear in these windows
4. Calculate asymmetric coupling ratios
```

### API Design
```
GET /repos/{repo_id}/coupling/temporal?path=src/auth/login.py&window_hours=4

Response: {
  "source_file": "src/auth/login.py",
  "window_hours": 4,
  "temporal_couplings": [
    {
      "file": "src/auth/session.py",
      "ratio": 0.82,
      "direction": "bidirectional",
      "avg_time_delta_minutes": 45
    }
  ]
}
```

### Performance Note
Temporal coupling is O(n²) - recommend running as background job and caching results.

---

## 5. Code Clone Detection Integration

### Priority: 🟡 Medium

### Description
Detect duplicate or near-duplicate code blocks across the codebase. When combined with coupling analysis, identify clones that co-evolve (refactoring candidates) vs. intentional duplication.

### Business Value
- **Technical Debt**: Quantify code duplication
- **Refactoring Priority**: Focus on clones that change together (co-evolving)
- **Architecture Insight**: Detect copy-paste inheritance patterns
- **Code Quality**: Reduce maintenance burden from duplicate code

### Implementation Details
Two-phase approach (per research):
1. **Token-based filtering** (fast): Find potential clones with >80% token similarity
2. **AST refinement** (precise): Confirm Type-2/3 clones on candidates

Integration with coupling:
```python
# Identify refactoring-important clones
for clone_pair in detected_clones:
    coupling = get_coupling(clone_pair.file_a, clone_pair.file_b)
    
    if coupling.pair_count > 5:  # They co-evolve
        clone_pair.importance = "HIGH - co-evolving, refactor to single location"
    else:
        clone_pair.importance = "LOW - intentional duplication, track only"
```

### API Design
```
POST /repos/{repo_id}/clones/detect
Body: {
  "min_tokens": 30,
  "similarity_threshold": 0.80,
  "include_coupling_analysis": true
}

Response: {
  "clone_groups": [
    {
      "clone_id": 1,
      "type": "Type-2",
      "fragments": [
        {"file": "src/utils/helpers.py", "lines": "45-72"},
        {"file": "src/api/utils.py", "lines": "120-147"}
      ],
      "similarity": 0.92,
      "co_evolution_score": 0.85,
      "recommendation": "Consolidate - these change together 85% of the time"
    }
  ],
  "summary": {
    "total_clones": 23,
    "high_priority": 8,
    "duplicated_lines": 1240
  }
}
```

---

## 6. Architecture Boundary Detection

### Priority: 🟡 Medium

### Description
Automatically detect logical module boundaries from coupling patterns and compare them against the actual folder structure to identify architectural misalignment.

### Business Value
- **Architecture Documentation**: Auto-generate module boundaries for undocumented codebases
- **Drift Detection**: Alert when coupling patterns violate intended architecture
- **Refactoring Guidance**: Show where files are misplaced
- **Team Organization**: Align team structure with code structure

### Implementation Details
Use hierarchical clustering on coupling data:
1. Build file-to-file coupling graph
2. Apply hierarchical clustering with cut-off threshold
3. Compare detected clusters to folder hierarchy
4. Identify "bridge files" that connect clusters

```
Detected vs Actual Architecture:

Detected (from coupling):          Actual (from folders):
┌─────────────────────────┐        ┌─────────────────────────┐
│ Module A                │        │ src/auth/               │
│  - auth/login.py       │        │  - login.py ✓           │
│  - auth/session.py     │        │  - session.py ✓         │
│  - api/auth_handler.py │ ←───── │ src/api/                │
└─────────────────────────┘        │  - auth_handler.py ⚠    │
                                   │  - user_handler.py      │
Misalignment detected:             └─────────────────────────┘
- api/auth_handler.py couples more with auth/ than api/
- Suggestion: Move to src/auth/handlers.py
```

### API Design
```
GET /repos/{repo_id}/architecture/boundaries

Response: {
  "detected_modules": [
    {
      "id": 1,
      "auto_name": "authentication",
      "files": ["src/auth/login.py", "src/auth/session.py", "src/api/auth_handler.py"],
      "internal_coupling": 0.78,
      "external_coupling": 0.12
    }
  ],
  "misalignments": [
    {
      "file": "src/api/auth_handler.py",
      "current_folder": "src/api/",
      "suggested_folder": "src/auth/",
      "reason": "78% coupling with auth/ module, only 12% with api/"
    }
  ],
  "architecture_health_score": 72
}
```

---

## 7. CI/CD Integration - PR Impact Bot

### Priority: 🟡 Medium

### Description
Provide a CI/CD integration that analyzes pull requests and comments with coupling impact analysis, missing file warnings, and suggested reviewers.

### Business Value
- **Code Review Quality**: Ensure coupled files aren't forgotten
- **Reduced Bugs**: Catch incomplete changes before merge
- **Reviewer Selection**: Suggest optimal reviewers based on knowledge
- **Automated Documentation**: PR comments become coupling documentation

### Implementation Details
GitHub Action / GitLab CI integration:
```yaml
# .github/workflows/lfca-check.yml
name: LFCA Coupling Check
on: [pull_request]

jobs:
  coupling-analysis:
    runs-on: ubuntu-latest
    steps:
      - uses: lfca/coupling-check@v1
        with:
          api-url: ${{ secrets.LFCA_API_URL }}
          repo-id: ${{ github.repository }}
```

PR Comment output:
```markdown
## 🔍 LFCA Coupling Analysis

### Changed Files Impact

| File | Coupled With | Status |
|------|--------------|--------|
| src/auth/login.py | src/auth/session.py (89%) | ✅ Modified |
| src/auth/login.py | tests/test_login.py (72%) | ⚠️ Not in PR |

### ⚠️ Missing Files
- `tests/test_login.py` - strongly coupled (72%), consider updating

### 👥 Suggested Reviewers
- @alice - auth module expert (score: 0.92)
- @bob - API knowledge (score: 0.67)

### 📊 Risk Score: 45/100 (Medium)
```

---

## 8. Merge Conflict Prediction

### Priority: 🟢 Low (Future)

### Description
Predict potential merge conflicts before they happen by analyzing which files are being modified in parallel branches.

### Business Value
- **Workflow Optimization**: Alert teams to coordinate on shared files
- **Reduced Merge Pain**: Proactively address conflicts
- **Integration Planning**: Schedule integrations when conflict risk is low

### Implementation Details
Based on research showing 90%+ accuracy using:
- Number of simultaneously changed files in both branches
- Historical conflict patterns
- Branch divergence metrics
- File overlap analysis

### API Design
```
GET /repos/{repo_id}/branches/conflict-risk?source=feature-x&target=main

Response: {
  "conflict_probability": 0.73,
  "risk_level": "high",
  "overlapping_files": [
    {
      "file": "src/api/handlers.py",
      "source_changes": 15,
      "target_changes": 8,
      "conflict_likelihood": 0.89
    }
  ],
  "recommendation": "Consider merging main into feature-x before continuing"
}
```

---

## 9. Natural Language Queries

### Priority: 🟢 Low (Future)

### Description
Allow users to ask questions about the codebase in natural language:
- "Which files should I look at if I want to change the login flow?"
- "Who knows the billing module best?"
- "What files are most likely to cause bugs?"

### Business Value
- **Accessibility**: Lower barrier to entry for coupling analysis
- **Discovery**: Users find insights they wouldn't think to query
- **Executive Reports**: Generate summaries in plain language

### Implementation Details
Use LLM to:
1. Parse natural language query
2. Map to LFCA API endpoints
3. Format results as conversational response

---

## 10. Visualization Enhancements

### Priority: 🟡 Medium

### Suggestions

#### 10.1 Interactive Dependency Matrix
NxN heatmap showing module-to-module coupling:
- Click cell for file-level details
- Filter by coupling strength
- Export as report

#### 10.2 Temporal Evolution Animation
Animated timeline showing:
- Cluster formation/dissolution over time
- File movements between modules
- Architecture evolution playback

#### 10.3 Treemap with Coupling Overlay
- Area = lines of code or churn
- Color = coupling health (green=healthy, red=problematic)
- Click to zoom into folders

---

## Implementation Roadmap

### Phase 0: Stabilization (Week 1)
1. ✅ Fix existing API issues (file details, search, prefix)

### Phase 1: Game-Changer (Weeks 2-7) ⭐
1. ⭐ **Language Server Integration** - TOP PRIORITY
   - Week 2-3: Language Server Adapter API & Python/Pylance integration
   - Week 4-5: Fusion engine (combine structural + logical coupling)
   - Week 6-7: UI screens (Dependency Explorer, Symbol View, Impact Wizard)
   - *Milestone: Demo fusion analysis on a Python/TypeScript project*

### Phase 2: Core Features (Weeks 8-11)
2. 🔴 **Hotspot Detection** - Churn × Complexity matrix
3. 🔴 **Change Impact Prediction** - Using fusion data for better predictions
4. 🟠 **Bus Factor & Knowledge Distribution**

### Phase 3: Intelligence (Weeks 12-15)
5. 🟠 **Temporal Coupling Detection**
6. 🟡 **Architecture Boundary Detection** (enhanced with structural data)
7. 🟡 **CI/CD PR Bot** - With fusion-aware impact warnings

### Phase 4: Polish & Scale (Weeks 16+)
8. 🟡 **Clone Detection Integration**
9. 🟡 **Visualization Enhancements**
10. 🟢 Multi-Language Support (Roslyn/.NET, rust-analyzer, gopls)
11. 🟢 Natural Language Queries
12. 🟢 Multi-Repository Analysis

---

## Competitive Differentiation

| Feature | CodeScene | Understand | NDepend | LFCA (Proposed) |
|---------|-----------|------------|---------|-----------------|
| **Structural + Logical Fusion** | ❌ | ❌ | ❌ | ⭐ **UNIQUE** |
| **Coupling Quadrant Analysis** | ❌ | ❌ | ❌ | ⭐ **UNIQUE** |
| **Symbol-Level Git Coupling** | ❌ | ❌ | ❌ | ⭐ **UNIQUE** |
| Language Server Integration | ❌ | Partial | ✅ (.NET only) | ✅ (Multi-lang) |
| Hotspot Analysis | ✅ | ✅ | ✅ | ✅ |
| Change Impact | ✅ | ❌ | ✅ | ✅ (Enhanced) |
| Bus Factor | ✅ | ❌ | ❌ | ✅ |
| Temporal Coupling | ✅ | ❌ | ❌ | ✅ |
| Clone Detection | ❌ | ✅ | ✅ | ✅ |
| Architecture Boundaries | ✅ | ✅ | ✅ | ✅ |
| CI/CD Integration | ✅ | ❌ | ✅ | ✅ |
| **Open Source** | ❌ | ❌ | ❌ | ✅ |
| **Interactive Viz** | Limited | Limited | Good | ✅ |

### LFCA's Unique Value Propositions

1. **Fusion Analysis (FIRST IN MARKET)** 
   - No other tool combines LSP structural data with git co-change patterns
   - Answers "why do these files couple?" not just "they couple"
   - Quadrant analysis reveals hidden dependencies AND dead code

2. **Symbol-Level Git Analysis (FIRST IN MARKET)**
   - Track which methods/classes co-change together
   - Impact analysis at function level, not just file level
   - "If I change Login(), what else needs updating?"

3. **Multi-Language, Open Source**
   - Commercial tools lock you into specific languages
   - LFCA's adapter pattern supports any LSP-compatible language
   - Community can contribute new language adapters

4. **Modern Architecture**
   - React/TypeScript frontend with D3 visualizations
   - FastAPI backend with plugin architecture
   - Extensible clustering algorithms

---

## Language Server Support Roadmap

| Language | Server | Priority | Status |
|----------|--------|----------|--------|
| **Python** | Pylance/Pyright | ⭐ Phase 1 | Planned |
| **TypeScript/JS** | tsserver | ⭐ Phase 1 | Planned |
| **C#/.NET** | Roslyn/OmniSharp | Phase 4 | Future |
| **Java** | Eclipse JDT LS | Phase 4 | Future |
| **Rust** | rust-analyzer | Phase 4 | Future |
| **Go** | gopls | Phase 4 | Future |

---

## References

1. **Language Server Protocol** - https://microsoft.github.io/language-server-protocol/
2. **Roslyn (.NET)** - https://github.com/dotnet/roslyn
3. **Pylance/Pyright** - https://github.com/microsoft/pyright
4. Apriori Algorithm - Association Rule Mining for Co-change Patterns
5. Adam Tornhill - "Software Design X-Rays" (Hotspot methodology)
6. PyDriller - Git mining framework patterns
7. Hercules - High-performance temporal analysis
8. SourcererCC - Scalable clone detection
9. CodeScene - Commercial feature reference (no fusion analysis)
10. NDepend - .NET static analysis reference
11. Academic: "Change Coupling Detection" chapter, software evolution mining
12. Research: Bus factor calculation with Degree of Authorship (DOA)

---

*Document maintained by the LFCA development team. Last updated: February 1, 2026*
