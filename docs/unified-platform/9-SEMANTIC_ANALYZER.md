# Semantic Analyzer (semantic-analyzer)

> **Status**: ❌ Not Implemented — only scaffolding exists

---

## Implementation Status

### ✅ Implemented
- Package scaffolding: `src/semantic-analyzer/pyproject.toml`, `src/semantic-analyzer/semantic_analyzer/__init__.py`
- `SemanticAnalyzerAPI` interface defined with 6 methods — `src/platform/code_intel/interfaces/semantic_analyzer.py`
- Frontend UI shells: `DomainMap`, `DomainDetail`, `BridgeEntities`, `SemanticLayout` — `src/frontend/src/features/semantic/`
- Frontend API client with types — `src/frontend/src/api/semantic.ts`
- Navigation tab configured

### 🔧 TODO
- [ ] Create `semantic_analyzer/plugin.py` — `SemanticPlugin` implementing `BaseAnalyzer`
- [ ] Create `semantic_analyzer/analyzer.py` — orchestration for tokenization + embedding + clustering
- [ ] Create `semantic_analyzer/extraction/tokenizer.py` — code tokenizer (identifiers, comments, strings)
- [ ] Create `semantic_analyzer/embedding/tfidf.py` — TF-IDF vectorizer + cosine similarity
- [ ] Add `sem_tokens`, `sem_domains`, `sem_domain_members` tables to `schema.py`
- [ ] Implement all 6 `SemanticAPI` methods
- [ ] Create `src/platform/code_intel/routers/semantic.py` router
- [ ] Register `SemanticPlugin` in `app.py`
- [ ] Wire frontend components to real API + add D3 domain visualization
- [ ] Add tests in `tests/test_semantic_analyzer/`

### 💡 Improvements
- Consider tree-sitter for language-aware tokenization
- Pre-built TF-IDF model could enable fast file classification without full re-analysis

---

## Purpose

Discover semantic domains (business concepts), extract tokens from code, compute file similarity, and identify bridge entities that span multiple domains.

## Project layout highlights

- `semantic_analyzer/plugin.py` — `SemanticPlugin` implements `BaseAnalyzer` and registers `SemanticAPI`.
- `semantic_analyzer/analyzer.py` — Orchestrates token extraction, embedding, clustering.
- `semantic_analyzer/extraction/` — Tokenizer, stopwords, extractor (AST/tree-sitter helpers).
- `semantic_analyzer/embedding/` — TF-IDF vectorizer, similarity functions, labeler.

## Capabilities (summary)

- get_domains(db_path)
- classify_file(db_path, file_path)
- get_similar_files(db_path, file_path, limit=10, min_similarity=0.5)
- get_file_tokens(db_path, file_path)
- get_domain_detail(db_path, domain_id)
- get_bridge_entities(db_path)

## Phase 3 tasks (short)

- Implement token extraction with tree-sitter/AST and a robust tokenizer.
- Compute TF-IDF vectors, cosine similarity, and clustering for domain discovery.
- Implement `SemanticPlugin` + API, platform router, and frontend (DomainMap, DomainDetail).

---

*See `1-UNIFIED_PLATFORM_OVERVIEW.md` and `3-PROJECT_SCAFFOLDING.md` for context.*