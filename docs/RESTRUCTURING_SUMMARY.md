# Project Restructuring Summary - Unified platform design

## Structure
The project has been split into a monorepo structure with independent packages:

1.  **platform/** (Package: `code-intel-platform`)
    *   **Orchestrator**: Manages projects and dispatches tasks.
    *   **API Gateway**: Unified FastAPI interface (`app.py`).
    *   **Interfaces**: Well-defined contracts for analyzers (`interfaces/`).
    *   **Registry**: Analyzer discovery mechanism (`registry.py`).
2.  **git-analyzer/** (Package: `git-analyzer`)
    *   Core git coupling logic moved from original `lfca`.
    *   Implements `GitAnalyzerInterface` and `GitAnalyzerAPI`.
3.  **dep-analyzer/** (Package: `dep-analyzer`)
    *   Specialized dependency analyzer (stub).
4.  **semantic-analyzer/** (Package: `semantic-analyzer`)
    *   Specialized semantic analyzer (stub).
5.  **project-intelligence/** (Package: `project-intelligence`)
    *   Cross-source insights (stub).

## Key Changes
-   Original `lfca/` package completely removed.
-   Code moved to `git-analyzer/git_analyzer/` and adapted for new structure.
-   Shared logic (Storage, Schema, Config) moved to `platform/code_intel/`.
-   Interfaces created in `platform/code_intel/interfaces/` to decouple analyzers from the platform.
-   Registry and Orchestrator implemented to allow plug-and-play analyzers.
-   New routers created: `repos.py`, `git.py`, `analyzers.py`.
-   Root `pyproject.toml` updated to a workspace-style structure.
-   Sub-project `pyproject.toml` files created for each component.

## Status
-   Backend restructuring: **COMPLETE**
-   Frontend адаптация (Out of scope): Pending (Phase 2)
-   Retro-compatibility: **NONE** (as requested)

## Next Steps (Phase 2 - Functional Implementation)

Goal: Achieve functional APIs for Git Source analysis.

### 1. Git Analyzer Implementation (`git-analyzer/git_analyzer/`)
-   **Plugin (`plugin.py`)**:
    -   [ ] Implement `analyze` method to trigger `runner.run_analysis`.
    -   [ ] Map `AnalysisTask` parameters to `runner` requirements.
-   **API (`api.py`)**:
    -   [ ] Implement `run_clustering` (integrate with `clustering/`).
    -   [ ] Implement `get_file_tree`.
    -   [ ] Implement `get_authors`.
    -   [ ] Implement `get_timeline`.
    -   [ ] Refine `get_coupling_graph` and `get_file_coupling` queries.
-   **Runner (`runner.py`)**:
    -   [ ] Verify integration with `code_intel.storage.Storage`.

### 2. Platform / Orchestrator (`platform/code_intel/`)
-   **Routers (`routers/git.py`)**:
    -   [ ] Verify parameter passing to `GitAPI`.
-   **Orchestrator (`orchestrator.py`)**:
    -   [ ] Ensure `run_analysis` can dispatch to `GitPlugin`.

### 3. Dependencies & Semantic (Skipped/Stubs)
-   Ensure `dep-analyzer` and `semantic-analyzer` return valid empty/stub responses to avoid runtime errors.
-   `Project Intelligence` to remain stubbed.

### 4. Verification
-   [ ] Run analysis on a test repository.
-   [ ] Test endpoints: `/repos/{id}/git/coupling`, `/repos/{id}/git/graph`, `/repos/{id}/git/clustering`.
