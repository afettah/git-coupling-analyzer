# Implement API Integration Tests

**Status:** In Progress  
**Priority:** High  
**Created:** 2026-02-01

---

## Objective

Create a comprehensive, fast, and deterministic test suite for the LFCA API that:
- Uses a synthetic git repository with **known, predictable coupling patterns**
- Runs in **< 30 seconds** for the full suite
- Protects against **regressions** when code changes
- Validates **expected behavior** (assumes all current issues are fixed)

---

## Testing Approach

### 1. Synthetic Test Repository

Instead of using real repositories (slow, non-deterministic), we create a **minimal synthetic git repo** with precisely controlled commit history.

#### Why Synthetic?
| Approach | Speed | Predictability | Maintenance |
|----------|-------|----------------|-------------|
| Real repo (OpenHands) | ❌ Slow (5k+ commits) | ❌ Changes over time | ❌ External dependency |
| Snapshot/fixture | ⚠️ Medium | ✅ Stable | ⚠️ Large files |
| **Synthetic repo** | ✅ Fast (<1s to create) | ✅ 100% deterministic | ✅ Code-defined |

#### Synthetic Repo Design

```
test_repo/
├── core/
│   ├── engine.py      # High coupling with utils.py
│   └── utils.py       # High coupling with engine.py
├── api/
│   ├── routes.py      # Medium coupling with handlers.py
│   └── handlers.py    # Medium coupling with routes.py
├── tests/
│   ├── test_engine.py # Must couple with core/engine.py
│   └── test_utils.py  # Must couple with core/utils.py
├── config.py          # Changed alone (no coupling)
├── README.md          # Changed alone (no coupling)
└── isolated.py        # Never co-changed with anything
```

### 2. Commit History Script

Python script that creates predictable git history:

```python
# tests/fixtures/create_test_repo.py

COMMIT_HISTORY = [
    # Commit 1-10: engine.py + utils.py always together (high coupling)
    {"files": ["core/engine.py", "core/utils.py"], "repeat": 10},
    
    # Commit 11-20: test files with their implementations
    {"files": ["core/engine.py", "tests/test_engine.py"], "repeat": 10},
    {"files": ["core/utils.py", "tests/test_utils.py"], "repeat": 10},
    
    # Commit 21-25: API files together (medium coupling)
    {"files": ["api/routes.py", "api/handlers.py"], "repeat": 5},
    
    # Commit 26-30: config.py alone (no coupling)
    {"files": ["config.py"], "repeat": 5},
    
    # Commit 31-35: README alone (no coupling)
    {"files": ["README.md"], "repeat": 5},
    
    # Commit 36: isolated.py (single commit, below threshold)
    {"files": ["isolated.py"], "repeat": 1},
    
    # Commit 37-40: Large changeset (should be excluded with max_changeset_size=10)
    {"files": ["core/engine.py", "core/utils.py", "api/routes.py", 
               "api/handlers.py", "config.py", "README.md", 
               "tests/test_engine.py", "tests/test_utils.py",
               "extra1.py", "extra2.py", "extra3.py"], "repeat": 4},
]
```

### 3. Expected Results (Ground Truth)

With the above history and default config (`min_revisions=5`, `max_changeset_size=10`):

#### Expected File Counts
| Metric | Expected Value |
|--------|----------------|
| Total files indexed | 8 (isolated.py excluded: <5 commits) |
| Current files at HEAD | 9 |
| Files with coupling | 6 |
| Files without coupling | 2 (config.py, README.md) |

#### Expected Coupling Pairs
| File A | File B | Expected Jaccard | Reason |
|--------|--------|------------------|--------|
| core/engine.py | core/utils.py | 1.0 | Always changed together (10 commits) |
| core/engine.py | tests/test_engine.py | ~0.5 | 10 shared commits out of 20 each |
| core/utils.py | tests/test_utils.py | ~0.5 | 10 shared commits out of 20 each |
| api/routes.py | api/handlers.py | 1.0 | Always changed together (5 commits) |
| config.py | * | 0.0 | Never co-changed |
| README.md | * | 0.0 | Never co-changed |

#### Expected Metrics
| File | Total Commits | Filtered Commits |
|------|---------------|------------------|
| core/engine.py | 24 | 20 (large changesets excluded) |
| core/utils.py | 24 | 20 |
| config.py | 9 | 5 |
| isolated.py | 5 | NOT INDEXED (below threshold after filtering) |

---

## Test Scenarios

### Scenario 1: Repository Creation & Analysis

```python
def test_create_and_analyze_repo():
    """
    GIVEN: A path to a valid git repository
    WHEN: POST /repos with path and name
    AND: POST /repos/{id}/analysis/start
    THEN: Analysis completes with correct counts
    """
    # Create repo
    resp = client.post("/repos", json={"path": TEST_REPO_PATH, "name": "test"})
    assert resp.status_code == 200
    assert resp.json()["state"] == "not_started"
    
    # Start analysis
    resp = client.post("/repos/test/analysis/start", json={
        "min_revisions": 5,
        "max_changeset_size": 10
    })
    assert resp.status_code == 200
    
    # Wait for completion
    status = wait_for_analysis("test")
    assert status["state"] == "complete"
    assert status["commit_count"] == 36  # 40 - 4 large changesets
    assert status["file_count"] == 8
    assert status["edge_count"] == 4  # 4 coupling pairs
```

### Scenario 2: File Listing & Filtering

```python
def test_file_listing():
    """
    GIVEN: An analyzed repository
    WHEN: GET /repos/{id}/files with various filters
    THEN: Returns correct files matching criteria
    """
    # All current files
    resp = client.get("/repos/test/files")
    assert len(resp.json()) == 8
    
    # Filter by path prefix
    resp = client.get("/repos/test/files?q=core/")
    files = resp.json()
    assert len(files) == 2
    assert all(f["path"].startswith("core/") for f in files)
    
    # Sort by commits descending
    resp = client.get("/repos/test/files?sort_by=commits&sort_dir=desc")
    files = resp.json()
    assert files[0]["total_commits"] >= files[1]["total_commits"]
    
    # Limit results
    resp = client.get("/repos/test/files?limit=3")
    assert len(resp.json()) == 3


def test_file_not_found():
    """
    GIVEN: A non-existent file path
    WHEN: GET /repos/{id}/files/{path}/details
    THEN: Returns 404 with proper error format
    """
    resp = client.get("/repos/test/files/nonexistent.py/details")
    assert resp.status_code == 404
    assert "error" in resp.json()
    assert resp.json()["error"]["code"] == "HTTP_404"
```

### Scenario 3: Coupling Detection Accuracy

```python
def test_high_coupling_detection():
    """
    GIVEN: Files that always change together (engine.py + utils.py)
    WHEN: GET /repos/{id}/coupling?path=core/engine.py
    THEN: Returns utils.py with jaccard ≈ 1.0
    """
    resp = client.get("/repos/test/coupling?path=core/engine.py")
    coupled = resp.json()
    
    # Find utils.py in results
    utils_coupling = next((c for c in coupled if c["path"] == "core/utils.py"), None)
    assert utils_coupling is not None
    assert utils_coupling["jaccard"] >= 0.9  # Allow small tolerance
    assert utils_coupling["pair_count"] == 10


def test_test_impl_coupling():
    """
    GIVEN: Test files that co-change with implementations
    WHEN: GET /repos/{id}/coupling?path=core/engine.py
    THEN: Returns test_engine.py with expected coupling
    """
    resp = client.get("/repos/test/coupling?path=core/engine.py")
    coupled = resp.json()
    
    test_coupling = next((c for c in coupled if "test_engine" in c["path"]), None)
    assert test_coupling is not None
    assert 0.4 <= test_coupling["jaccard"] <= 0.6  # ~50% overlap


def test_no_coupling_for_isolated_file():
    """
    GIVEN: A file that never co-changes (config.py)
    WHEN: GET /repos/{id}/coupling?path=config.py
    THEN: Returns empty list
    """
    resp = client.get("/repos/test/coupling?path=config.py")
    assert resp.json() == []


def test_coupling_metrics_validity():
    """
    GIVEN: Any coupling result
    WHEN: Examining metric values
    THEN: All metrics are within valid ranges
    """
    resp = client.get("/repos/test/coupling?path=core/engine.py")
    for coupling in resp.json():
        assert 0 <= coupling["jaccard"] <= 1
        assert 0 <= coupling["p_dst_given_src"] <= 1
        assert 0 <= coupling["p_src_given_dst"] <= 1
        assert coupling["pair_count"] > 0
```

### Scenario 4: Coupling Evidence

```python
def test_coupling_evidence():
    """
    GIVEN: Two coupled files
    WHEN: GET /repos/{id}/coupling/evidence?src_path=A&dst_path=B
    THEN: Returns list of commits where both changed
    """
    resp = client.get("/repos/test/coupling/evidence", params={
        "src_path": "core/engine.py",
        "dst_path": "core/utils.py"
    })
    evidence = resp.json()
    
    assert len(evidence["commits"]) == 10
    for commit in evidence["commits"]:
        assert "oid" in commit
        assert "message" in commit
        assert "timestamp" in commit
```

### Scenario 5: Clustering Algorithms

```python
def test_louvain_clustering():
    """
    GIVEN: Files with known coupling structure
    WHEN: POST /repos/{id}/clustering/run with louvain
    THEN: Groups coupled files together
    """
    resp = client.post("/repos/test/clustering/run", json={
        "algorithm": "louvain",
        "weight_column": "jaccard",
        "min_weight": 0.1
    })
    result = resp.json()
    
    assert result["cluster_count"] >= 2  # At least core and api clusters
    
    # Find cluster containing engine.py
    engine_cluster = find_cluster_with_file(result["clusters"], "core/engine.py")
    assert "core/utils.py" in get_cluster_files(engine_cluster)


def test_clustering_with_folder_filter():
    """
    GIVEN: Request to cluster only specific folder
    WHEN: POST /repos/{id}/clustering/run with folders=["core"]
    THEN: Only core files are in clusters
    """
    resp = client.post("/repos/test/clustering/run", json={
        "algorithm": "louvain",
        "folders": ["core"]
    })
    result = resp.json()
    
    all_files = get_all_clustered_files(result["clusters"])
    assert all(f.startswith("core/") or f.startswith("tests/test_") for f in all_files)


def test_invalid_algorithm_error():
    """
    GIVEN: Invalid algorithm name
    WHEN: POST /repos/{id}/clustering/run
    THEN: Returns 400 with validation error
    """
    resp = client.post("/repos/test/clustering/run", json={
        "algorithm": "invalid_algo"
    })
    assert resp.status_code == 400
    assert "error" in resp.json()
```

### Scenario 6: Snapshot Management

```python
def test_snapshot_lifecycle():
    """
    GIVEN: A clustering result
    WHEN: Save, list, get, update, delete snapshot
    THEN: All operations succeed correctly
    """
    # Run clustering
    cluster_result = client.post("/repos/test/clustering/run", json={
        "algorithm": "louvain"
    }).json()
    
    # Save snapshot
    resp = client.post("/repos/test/clustering/snapshots", json={
        "name": "test_snapshot",
        "result": cluster_result,
        "tags": ["test", "louvain"]
    })
    assert resp.status_code == 200
    snapshot_id = resp.json()["id"]
    
    # List snapshots
    resp = client.get("/repos/test/clustering/snapshots")
    snapshots = resp.json()
    assert any(s["id"] == snapshot_id for s in snapshots)
    
    # Get snapshot
    resp = client.get(f"/repos/test/clustering/snapshots/{snapshot_id}")
    assert resp.json()["name"] == "test_snapshot"
    
    # Update snapshot
    resp = client.put(f"/repos/test/clustering/snapshots/{snapshot_id}", json={
        "name": "renamed_snapshot"
    })
    assert resp.status_code == 200
    
    # Delete snapshot
    resp = client.delete(f"/repos/test/clustering/snapshots/{snapshot_id}")
    assert resp.status_code == 200
    
    # Verify deleted
    resp = client.get(f"/repos/test/clustering/snapshots/{snapshot_id}")
    assert resp.status_code == 404
```

### Scenario 7: Error Handling

```python
def test_nonexistent_repo_returns_404():
    """
    GIVEN: Non-existent repository ID
    WHEN: Any endpoint is called
    THEN: Returns 404 with proper error format
    """
    resp = client.get("/repos/nonexistent/files")
    assert resp.status_code == 404
    assert resp.json()["error"]["code"] == "HTTP_404"


def test_invalid_path_returns_400():
    """
    GIVEN: Invalid parameter values
    WHEN: GET /repos/{id}/files?sort_by=invalid
    THEN: Returns 400 with validation error
    """
    resp = client.get("/repos/test/files?sort_by=invalid")
    assert resp.status_code == 400


def test_create_repo_invalid_path():
    """
    GIVEN: Non-existent path
    WHEN: POST /repos with invalid path
    THEN: Returns 400 with clear error message
    """
    resp = client.post("/repos", json={
        "path": "/nonexistent/path",
        "name": "test"
    })
    assert resp.status_code == 400
    assert "does not exist" in resp.json()["error"]["message"]


def test_create_repo_not_git():
    """
    GIVEN: Path that exists but is not a git repo
    WHEN: POST /repos
    THEN: Returns 400 with "not a git repository" error
    """
    resp = client.post("/repos", json={
        "path": "/tmp",
        "name": "test"
    })
    assert resp.status_code == 400
    assert "git repository" in resp.json()["error"]["message"].lower()
```

### Scenario 8: Data Integrity

```python
def test_no_synthetic_files_in_results():
    """
    GIVEN: Analyzed repository
    WHEN: GET /repos/{id}/files
    THEN: No synthetic entries (A, D, M, __LFCA_COMMIT__)
    """
    resp = client.get("/repos/test/files?current_only=false&limit=1000")
    files = resp.json()
    
    invalid_paths = {"A", "D", "M", "R", "__LFCA_COMMIT__"}
    for f in files:
        assert f["path"] not in invalid_paths
        assert not f["path"].startswith("__LFCA_")
        assert "@" not in f["path"]  # No email addresses
        assert len(f["path"]) > 1  # No single-char paths


def test_file_ids_consistency():
    """
    GIVEN: Coupling results with file IDs
    WHEN: Looking up those IDs
    THEN: All IDs resolve to valid files
    """
    resp = client.get("/repos/test/coupling?path=core/engine.py")
    for coupling in resp.json():
        file_id = coupling["file_id"]
        # Verify file exists in files table
        files_resp = client.get(f"/repos/test/files?current_only=false")
        file_ids = {f["file_id"] for f in files_resp.json()}
        assert file_id in file_ids
```

### Scenario 9: Large Changeset Filtering

```python
def test_large_changeset_excluded():
    """
    GIVEN: Commits with >max_changeset_size files
    WHEN: Analysis runs with max_changeset_size=10
    THEN: Those commits don't affect coupling calculations
    """
    # With our test data, large changesets (11 files) should be excluded
    # This means engine.py and config.py should NOT be coupled
    # (they only co-occur in the large changesets)
    
    resp = client.get("/repos/test/coupling?path=core/engine.py")
    coupled_paths = [c["path"] for c in resp.json()]
    
    # config.py should NOT appear (only co-changed in large commits)
    assert "config.py" not in coupled_paths
```

### Scenario 10: Rename Tracking

```python
def test_rename_tracking():
    """
    GIVEN: A file that was renamed in git history
    WHEN: GET /repos/{id}/files/{path}/lineage
    THEN: Shows rename history
    """
    # This requires adding a rename to our test repo fixture
    resp = client.get("/repos/test/files/renamed_file.py/lineage")
    lineage = resp.json()
    
    assert len(lineage["renames"]) >= 1
    assert lineage["renames"][0]["old_path"] == "original_name.py"
```

---

## Test Infrastructure

### Fixture: Create Test Repository

```python
# tests/conftest.py

import pytest
import tempfile
import subprocess
from pathlib import Path

@pytest.fixture(scope="session")
def test_repo():
    """Create synthetic git repository for testing."""
    with tempfile.TemporaryDirectory() as tmpdir:
        repo_path = Path(tmpdir) / "test_repo"
        create_test_repo(repo_path)
        yield repo_path


def create_test_repo(path: Path):
    """Create a git repo with deterministic commit history."""
    path.mkdir(parents=True)
    
    # Initialize git
    run_git(path, "init")
    run_git(path, "config", "user.email", "test@example.com")
    run_git(path, "config", "user.name", "Test User")
    
    # Create file structure
    (path / "core").mkdir()
    (path / "api").mkdir()
    (path / "tests").mkdir()
    
    # Generate commits according to COMMIT_HISTORY
    for i, entry in enumerate(COMMIT_HISTORY):
        for _ in range(entry["repeat"]):
            for file_path in entry["files"]:
                full_path = path / file_path
                full_path.parent.mkdir(parents=True, exist_ok=True)
                # Append unique content to create a real change
                with open(full_path, "a") as f:
                    f.write(f"# Change {i}\n")
            
            run_git(path, "add", ".")
            run_git(path, "commit", "-m", f"Commit for {entry['files']}")


def run_git(path: Path, *args):
    """Run git command in repo."""
    subprocess.run(
        ["git", *args],
        cwd=path,
        check=True,
        capture_output=True
    )
```

### Fixture: API Client

```python
@pytest.fixture(scope="session")
def api_client(test_repo):
    """Create test client and initialize repo."""
    from fastapi.testclient import TestClient
    from lfca.api import app
    
    client = TestClient(app)
    
    # Create and analyze test repo
    client.post("/repos", json={
        "path": str(test_repo),
        "name": "test",
        "data_dir": "test_data"
    })
    
    client.post("/repos/test/analysis/start", json={
        "min_revisions": 5,
        "max_changeset_size": 10,
        "data_dir": "test_data"
    })
    
    # Wait for completion
    import time
    for _ in range(30):
        status = client.get("/repos/test/analysis/status?data_dir=test_data").json()
        if status["state"] == "complete":
            break
        time.sleep(0.1)
    
    yield client
    
    # Cleanup
    import shutil
    shutil.rmtree("test_data", ignore_errors=True)
```

---

## Test Organization

```
tests/
├── conftest.py              # Fixtures: test_repo, api_client
├── fixtures/
│   └── create_test_repo.py  # Synthetic repo creation
├── api/
│   ├── test_repos.py        # Scenario 1: Create/analyze
│   ├── test_files.py        # Scenario 2: File listing
│   ├── test_coupling.py     # Scenarios 3-4: Coupling
│   ├── test_clustering.py   # Scenario 5: Clustering
│   ├── test_snapshots.py    # Scenario 6: Snapshots
│   ├── test_errors.py       # Scenario 7: Error handling
│   └── test_data_integrity.py  # Scenario 8: Data integrity
└── integration/
    └── test_full_workflow.py   # End-to-end scenarios
```

---

## Running Tests

```bash
# Run all API tests
pytest tests/api/ -v

# Run with coverage
pytest tests/api/ --cov=lfca --cov-report=html

# Run specific scenario
pytest tests/api/test_coupling.py -v

# Run fast (exclude slow integration tests)
pytest tests/api/ -v -m "not slow"
```

---

## Success Criteria

| Metric | Target |
|--------|--------|
| Test count | 30+ test cases |
| Execution time | < 30 seconds |
| Coverage | > 80% of API endpoints |
| Flakiness | 0 flaky tests |
| Determinism | 100% reproducible results |

---

## Implementation Plan

- [ ] Create `tests/fixtures/create_test_repo.py` with COMMIT_HISTORY
- [ ] Create `tests/conftest.py` with fixtures
- [ ] Implement Scenario 1: test_repos.py
- [ ] Implement Scenario 2: test_files.py
- [ ] Implement Scenario 3-4: test_coupling.py
- [ ] Implement Scenario 5: test_clustering.py
- [ ] Implement Scenario 6: test_snapshots.py
- [ ] Implement Scenario 7: test_errors.py
- [ ] Implement Scenario 8: test_data_integrity.py
- [ ] Add CI integration (GitHub Actions)
- [ ] Document test patterns for future contributors
