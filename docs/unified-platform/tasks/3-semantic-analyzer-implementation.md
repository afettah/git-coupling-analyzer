# Semantic Analyzer Implementation

> **Priority**: Medium (Phase 3)
> **Depends on**: Platform interfaces (✅ done), preferably dep-analyzer done first
> **Design doc**: `docs/unified-platform/9-SEMANTIC_ANALYZER.md`

## Summary
Implement the semantic analyzer: token extraction, TF-IDF embedding, domain clustering.

## Tasks

### Backend
- [ ] Create `src/semantic-analyzer/semantic_analyzer/plugin.py` — `SemanticPlugin(BaseAnalyzer)` + `SemanticAPI(SemanticAnalyzerAPI)`
- [ ] Create `src/semantic-analyzer/semantic_analyzer/analyzer.py` — main analysis orchestration
- [ ] Create `src/semantic-analyzer/semantic_analyzer/extraction/tokenizer.py` — code tokenizer
- [ ] Create `src/semantic-analyzer/semantic_analyzer/embedding/tfidf.py` — TF-IDF + similarity
- [ ] Create `src/semantic-analyzer/semantic_analyzer/clustering/domain_discovery.py` — domain clustering
- [ ] Add `sem_tokens`, `sem_domains`, `sem_domain_members` tables to `schema.py`
- [ ] Implement 6 `SemanticAPI` query methods
- [ ] Create `src/platform/code_intel/routers/semantic.py`
- [ ] Register `SemanticPlugin` in `app.py`

### Frontend
- [ ] Wire `DomainMap` component to real API + D3 visualization
- [ ] Wire `DomainDetail` component to real API
- [ ] Wire `BridgeEntities` component to real API

### Testing
- [ ] Add unit tests in `tests/test_semantic_analyzer/`
- [ ] Test tokenizer with various languages
- [ ] Integration test: analyze repo → query semantic API
