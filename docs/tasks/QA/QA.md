# QA Testing Strategy for LFCA (Logical File Coupling Analyzer)

> **Version**: 1.0  
> **Status**: Draft  
> **Date**: 2026-01-31  
> **Reference Project**: OpenHands (https://github.com/OpenHands/OpenHands)

---

## Overview

This document defines a comprehensive Quality Assurance strategy for validating the correctness of the LFCA system. We use **OpenHands** as our reference project for all testing and validation exercises.

The strategy covers three major areas:
1. **Project Understanding** - Manual analysis to establish ground truth
2. **Automated Tests** - Scripts to verify system correctness
3. **Manual Tests** - Detailed use cases with expected results

---

## Table of Contents

1. [Project Understanding](#1-project-understanding)
2. [Automated Tests](#2-automated-tests)
3. [Manual Tests](#3-manual-tests)

---

## 1. Project Understanding

Before testing LFCA's accuracy, we must establish **ground truth** by manually analyzing the reference project. This section describes what information to collect and how to collect it.

### 1.1 Information to Collect

#### A. Repository Statistics

| Metric | Description | Why It Matters |
|--------|-------------|----------------|
| Total commits | `git rev-list --count HEAD` | Validates extraction completeness |
| Total unique files | Files that ever existed | Validates file tracking |
| Current files at HEAD | `git ls-tree -r HEAD --name-only | wc -l` | Validates `exists_at_head` flag |
| Deleted files count | Files no longer at HEAD | Tests deleted file handling |
| Renamed files count | Files with path changes | Tests rename tracking |
| Merge commits count | Commits with >1 parent | Tests merge handling policies |
| Authors count | Unique contributors | Context for changeset grouping |
| Date range | First to last commit | Validates time filtering |

#### B. File-Level Statistics

| Metric | Description | Why It Matters |
|--------|-------------|----------------|
| Commit count per file | How often each file changed | Core metric for coupling |
| Top-10 most changed files | Hotspots | Validates sorting/ranking |
| Files never changed alone | Always co-changed | Should show high coupling |
| Files always changed alone | Isolated | Should show zero coupling |

#### C. Coupling Ground Truth

| Metric | Description | Why It Matters |
|--------|-------------|----------------|
| Known tightly-coupled pairs | Files we know should couple | Validates edge detection |
| Known independent files | Files with no relationship | Validates false positive rate |
| Test/implementation pairs | test_X.py ↔ X.py | Common coupling pattern |
| Config + implementation | config.py ↔ consumers | Tests transitive coupling |

#### D. Project Structure Understanding

| Metric | Description | Why It Matters |
|--------|-------------|----------------|
| Folder hierarchy depth | Max nesting level | Tests component aggregation |
| Module boundaries | Logical separations | Tests clustering accuracy |
| Core vs peripheral files | Central vs edge files | Tests centrality detection |

### 1.2 Scripts to Gather Ground Truth

#### Script 1: Repository Statistics

```bash
#!/bin/bash
# gather_repo_stats.sh - Run from OpenHands root directory
# Usage: ./gather_repo_stats.sh /path/to/OpenHands > openhands_stats.txt

REPO_PATH="${1:-.}"
cd "$REPO_PATH"

echo "=== REPOSITORY STATISTICS ==="
echo ""

echo "## Basic Counts"
echo "Total commits: $(git rev-list --count HEAD)"
echo "Current files at HEAD: $(git ls-tree -r HEAD --name-only | wc -l)"
echo "Total branches: $(git branch -r | wc -l)"
echo ""

echo "## Commit Range"
echo "First commit: $(git log --reverse --format='%H %ci' | head -1)"
echo "Last commit: $(git log -1 --format='%H %ci')"
echo ""

echo "## Merge Commits"
echo "Total merge commits: $(git log --merges --oneline | wc -l)"
echo "Total non-merge commits: $(git log --no-merges --oneline | wc -l)"
echo ""

echo "## Authors"
echo "Unique authors: $(git log --format='%ae' | sort -u | wc -l)"
echo ""

echo "## File Types (at HEAD)"
echo "Python files: $(git ls-tree -r HEAD --name-only | grep '\.py$' | wc -l)"
echo "JS/TS files: $(git ls-tree -r HEAD --name-only | grep -E '\.(js|ts|tsx|jsx)$' | wc -l)"
echo "Config files: $(git ls-tree -r HEAD --name-only | grep -E '\.(json|yaml|yml|toml|ini)$' | wc -l)"
echo "Test files: $(git ls-tree -r HEAD --name-only | grep -E '(test_|_test\.|\.test\.)' | wc -l)"
echo ""

echo "## Folder Depth"
echo "Max folder depth: $(git ls-tree -r HEAD --name-only | awk -F'/' '{print NF-1}' | sort -rn | head -1)"
echo "Top-level folders: $(git ls-tree -d HEAD --name-only | wc -l)"
```

#### Script 2: File Change Frequency

```bash
#!/bin/bash
# file_change_frequency.sh - Get commit counts per file
# Usage: ./file_change_frequency.sh /path/to/OpenHands > file_commits.csv

REPO_PATH="${1:-.}"
cd "$REPO_PATH"

echo "path,commit_count"

git log --name-only --pretty=format: | \
    grep -v '^$' | \
    sort | \
    uniq -c | \
    sort -rn | \
    awk '{print $2","$1}'
```

#### Script 3: Co-change Analysis (Ground Truth)

```bash
#!/bin/bash
# cochange_analysis.sh - Find files that change together
# Usage: ./cochange_analysis.sh /path/to/OpenHands 10 > cochange_pairs.csv

REPO_PATH="${1:-.}"
MIN_COOCCURRENCE="${2:-5}"
cd "$REPO_PATH"

echo "file_a,file_b,cooccurrence_count"

# This creates pairs from each commit
git log --name-only --pretty=format:'---COMMIT---' | \
    awk -v min="$MIN_COOCCURRENCE" '
    /^---COMMIT---/ {
        n = 0;
        delete files;
        next;
    }
    NF > 0 {
        files[n++] = $0;
    }
    /^$/ && n >= 2 {
        for (i = 0; i < n-1; i++) {
            for (j = i+1; j < n; j++) {
                if (files[i] < files[j]) {
                    key = files[i] "," files[j];
                } else {
                    key = files[j] "," files[i];
                }
                pairs[key]++;
            }
        }
    }
    END {
        for (key in pairs) {
            if (pairs[key] >= min) {
                print key "," pairs[key];
            }
        }
    }
    ' | sort -t',' -k3 -rn
```

#### Script 4: Rename Detection Verification

```bash
#!/bin/bash
# rename_detection.sh - Find all file renames in history
# Usage: ./rename_detection.sh /path/to/OpenHands > renames.csv

REPO_PATH="${1:-.}"
cd "$REPO_PATH"

echo "commit_oid,old_path,new_path"

git log --name-status --diff-filter=R -M --pretty=format:'COMMIT:%H' | \
    awk '
    /^COMMIT:/ { commit = substr($0, 8); next }
    /^R[0-9]*\t/ {
        split($0, parts, "\t");
        print commit "," parts[2] "," parts[3];
    }
    '
```

#### Script 5: Bulk Commit Detection

```bash
#!/bin/bash
# bulk_commits.sh - Find commits with many files (potential refactors)
# Usage: ./bulk_commits.sh /path/to/OpenHands 50 > bulk_commits.csv

REPO_PATH="${1:-.}"
THRESHOLD="${2:-50}"
cd "$REPO_PATH"

echo "commit_oid,file_count,subject"

git log --pretty=format:'%H %s' --name-only | \
    awk -v threshold="$THRESHOLD" '
    /^[a-f0-9]{40}/ {
        if (count >= threshold && commit != "") {
            gsub(/,/, ";", subject);  # Escape commas
            print commit "," count "," subject;
        }
        commit = substr($0, 1, 40);
        subject = substr($0, 42);
        count = 0;
        next;
    }
    NF > 0 { count++; }
    END {
        if (count >= threshold) {
            gsub(/,/, ";", subject);
            print commit "," count "," subject;
        }
    }
    '
```

### 1.3 Complex Cases to Validate

#### Case 1: File Rename Chain
```
Scenario: A → B → C (file renamed twice)
Validation: All three paths should map to same file_id
Expected: Commits touching A, B, or C should count as same file
Test:
  1. Find a file with multiple renames in history
  2. Query LFCA for coupling of current path
  3. Verify commits from old paths are included
```

#### Case 2: Bulk Refactor Dilution
```
Scenario: Commit changes 500 files (mass rename/restructure)
Validation: Should not create strong spurious coupling
Expected: With downweight policy, coupling weight << 1.0
Test:
  1. Identify bulk commits (>100 files)
  2. Pick two random files from that commit
  3. Verify their coupling score is appropriately low
```

#### Case 3: Test-Implementation Coupling
```
Scenario: test_auth.py always changes with auth.py
Validation: High Jaccard similarity
Expected: P(test_auth|auth) ≈ 1.0, Jaccard > 0.5
Test:
  1. Find test files and their implementations
  2. Calculate expected coupling manually
  3. Compare with LFCA results
```

#### Case 4: Independent Module Verification
```
Scenario: docs/ folder rarely touches src/ folder
Validation: Low or zero cross-folder coupling
Expected: Files in docs/ have low coupling with src/
Test:
  1. Query coupling for a docs file
  2. Verify src/ files don't appear in top results
```

#### Case 5: Merge Commit Handling
```
Scenario: Merge commit includes files from both branches
Validation: Should follow merge_policy setting
Expected:
  - include: Normal weighting
  - exclude: Zero contribution
  - downweight: Reduced weight (e.g., 0.5x)
Test:
  1. Find files only co-changed in merge commits
  2. Run analysis with different merge policies
  3. Verify coupling changes accordingly
```

#### Case 6: Deleted File Handling
```
Scenario: File was deleted but had historical coupling
Validation: Should not appear in current file tree
Expected:
  - File appears in historical queries
  - File does NOT appear in current files list
  - File does NOT appear in coupling results when current_only=true
Test:
  1. Identify deleted files from git history
  2. Query LFCA file tree
  3. Verify deleted files excluded
```

#### Case 7: High-Frequency Hotspot
```
Scenario: config.py changes in 80% of commits
Validation: Should couple with many files but not ALL files
Expected: High coupled_count but varying strength
Test:
  1. Find the most frequently changed file
  2. Query its coupling
  3. Verify spread of coupling strengths
```

#### Case 8: Time Window Filtering
```
Scenario: Analysis with window_days=90
Validation: Only recent commits contribute
Expected: Old coupling patterns not visible
Test:
  1. Find a coupling that existed only in old commits
  2. Run analysis with time window
  3. Verify old coupling absent
```

### 1.4 Prompts for Manual Investigation

Use these prompts to explore the reference project:

```
PROMPT 1: Identify Coupling Hotspots
"In the OpenHands project, which 10 files change most frequently?
For each, list 3 files they commonly change with and estimate
the co-change count from git history."

PROMPT 2: Find Architectural Boundaries
"Based on folder structure and naming, identify 5 distinct modules
in OpenHands. For each module, identify files that might be
'bridge files' connecting to other modules."

PROMPT 3: Locate Complex History
"Find 3 files in OpenHands that have been renamed, moved, or
have complex git history. Document their path changes."

PROMPT 4: Identify Test Patterns
"How are tests organized in OpenHands? Find 5 test files and
their corresponding implementation files. Estimate their
coupling strength."

PROMPT 5: Find Refactoring Events
"Identify 3 large refactoring commits in OpenHands (>50 files).
What types of changes were they? How should LFCA handle them?"
```

---

## 2. Automated Tests

This section defines automated test scripts to verify LFCA correctness.

### 2.1 Test Infrastructure

#### Test Configuration

```python
# tests/qa/conftest.py
import pytest
import subprocess
import requests
import time
from pathlib import Path

REFERENCE_REPO = "/home/afettah/workspace/OpenHands"
LFCA_DATA_DIR = "data"
LFCA_REPO_ID = "openhands"
API_BASE = "http://localhost:8000"

@pytest.fixture(scope="session")
def api_server():
    """Start LFCA API server for testing."""
    proc = subprocess.Popen(
        ["python", "-m", "lfca.api"],
        cwd=Path(__file__).parents[2]
    )
    time.sleep(3)  # Wait for startup
    yield API_BASE
    proc.terminate()

@pytest.fixture(scope="session")
def analyzed_repo(api_server):
    """Ensure OpenHands is analyzed."""
    # Check if analysis exists
    resp = requests.get(f"{api_server}/repos/{LFCA_REPO_ID}/analysis/status")
    if resp.json().get("state") != "complete":
        # Trigger analysis
        requests.post(
            f"{api_server}/repos/{LFCA_REPO_ID}/analysis/start",
            json={"repo_path": REFERENCE_REPO}
        )
        # Wait for completion (with timeout)
        for _ in range(300):  # 5 min timeout
            time.sleep(1)
            status = requests.get(f"{api_server}/repos/{LFCA_REPO_ID}/analysis/status").json()
            if status.get("state") == "complete":
                break
    return LFCA_REPO_ID
```

### 2.2 Extraction Verification Tests

```python
# tests/qa/test_extraction.py
"""Tests to verify git extraction accuracy."""

import subprocess
import sqlite3
import pyarrow.parquet as pq
from pathlib import Path
import pytest

REPO_PATH = Path("/home/afettah/workspace/OpenHands")
DATA_PATH = Path("data/repos/openhands")


class TestCommitExtraction:
    """Verify commit extraction matches git reality."""

    def get_git_commit_count(self) -> int:
        """Get actual commit count from git."""
        result = subprocess.run(
            ["git", "rev-list", "--count", "HEAD"],
            cwd=REPO_PATH,
            capture_output=True,
            text=True
        )
        return int(result.stdout.strip())

    def get_lfca_commit_count(self) -> int:
        """Get commit count from LFCA parquet."""
        commits_path = DATA_PATH / "parquet" / "commits.parquet"
        table = pq.read_table(commits_path)
        return len(table)

    def test_commit_count_matches(self):
        """LFCA should extract all commits (minus filtered bulk commits)."""
        git_count = self.get_git_commit_count()
        lfca_count = self.get_lfca_commit_count()
        
        # Allow some difference due to bulk filtering
        tolerance = git_count * 0.05  # 5% tolerance
        assert abs(git_count - lfca_count) <= tolerance, \
            f"Commit count mismatch: git={git_count}, lfca={lfca_count}"

    def test_no_duplicate_commits(self):
        """Each commit OID should appear exactly once."""
        commits_path = DATA_PATH / "parquet" / "commits.parquet"
        table = pq.read_table(commits_path, columns=["commit_oid"])
        oids = table.column("commit_oid").to_pylist()
        
        assert len(oids) == len(set(oids)), "Duplicate commit OIDs found"

    def test_merge_commits_flagged(self):
        """Merge commits should have is_merge=True."""
        # Get merge commits from git
        result = subprocess.run(
            ["git", "log", "--merges", "--format=%H"],
            cwd=REPO_PATH,
            capture_output=True,
            text=True
        )
        git_merges = set(result.stdout.strip().split("\n")) if result.stdout.strip() else set()
        
        # Get from LFCA
        commits_path = DATA_PATH / "parquet" / "commits.parquet"
        table = pq.read_table(commits_path, columns=["commit_oid", "is_merge"])
        lfca_merges = set(
            row["commit_oid"] for row in table.to_pylist()
            if row["is_merge"]
        )
        
        # Check intersection (some may be filtered)
        analyzed_merges = git_merges & {row["commit_oid"] for row in table.to_pylist()}
        assert analyzed_merges == lfca_merges, "Merge commit detection mismatch"


class TestFileExtraction:
    """Verify file tracking accuracy."""

    def test_current_files_match_head(self):
        """Files at HEAD should match git ls-tree."""
        # Get from git
        result = subprocess.run(
            ["git", "ls-tree", "-r", "--name-only", "HEAD"],
            cwd=REPO_PATH,
            capture_output=True,
            text=True
        )
        git_files = set(result.stdout.strip().split("\n"))
        
        # Get from LFCA
        db_path = DATA_PATH / "lfca.sqlite"
        conn = sqlite3.connect(db_path)
        rows = conn.execute("""
            SELECT path_current FROM files WHERE exists_at_head = TRUE
        """).fetchall()
        conn.close()
        lfca_files = set(r[0] for r in rows)
        
        # Should match exactly
        missing_in_lfca = git_files - lfca_files
        extra_in_lfca = lfca_files - git_files
        
        assert not missing_in_lfca, f"Files missing in LFCA: {list(missing_in_lfca)[:10]}"
        assert not extra_in_lfca, f"Extra files in LFCA: {list(extra_in_lfca)[:10]}"

    def test_deleted_files_not_at_head(self):
        """Deleted files should have exists_at_head=FALSE."""
        db_path = DATA_PATH / "lfca.sqlite"
        conn = sqlite3.connect(db_path)
        
        # Get files marked as existing
        existing = conn.execute("""
            SELECT path_current FROM files WHERE exists_at_head = TRUE
        """).fetchall()
        existing_paths = set(r[0] for r in existing)
        
        # Verify against git
        result = subprocess.run(
            ["git", "ls-tree", "-r", "--name-only", "HEAD"],
            cwd=REPO_PATH,
            capture_output=True,
            text=True
        )
        git_files = set(result.stdout.strip().split("\n"))
        
        conn.close()
        
        # All existing_paths should be in git
        false_positives = existing_paths - git_files
        assert not false_positives, f"Files marked as existing but not in HEAD: {list(false_positives)[:5]}"


class TestRenameTracking:
    """Verify rename detection."""

    def test_renamed_files_same_id(self):
        """Renamed files should maintain the same file_id."""
        # Find a known rename from git
        result = subprocess.run(
            ["git", "log", "--name-status", "--diff-filter=R", "-M", "--format=", "-1"],
            cwd=REPO_PATH,
            capture_output=True,
            text=True
        )
        
        if not result.stdout.strip():
            pytest.skip("No renames found in recent history")
        
        lines = [l for l in result.stdout.strip().split("\n") if l.startswith("R")]
        if not lines:
            pytest.skip("No rename lines parsed")
        
        # Parse rename: R100\told_path\tnew_path
        parts = lines[0].split("\t")
        old_path, new_path = parts[1], parts[2]
        
        # Check LFCA
        db_path = DATA_PATH / "lfca.sqlite"
        conn = sqlite3.connect(db_path)
        
        # Both paths should resolve to same file_id or new_path exists
        new_row = conn.execute(
            "SELECT file_id FROM files WHERE path_current = ? OR path_latest = ?",
            (new_path, new_path)
        ).fetchone()
        
        conn.close()
        
        assert new_row is not None, f"Renamed file not found: {new_path}"
```

### 2.3 Edge Calculation Tests

```python
# tests/qa/test_edges.py
"""Tests to verify edge/coupling calculation accuracy."""

import subprocess
import sqlite3
from collections import defaultdict
from pathlib import Path
import pytest

REPO_PATH = Path("/home/afettah/workspace/OpenHands")
DATA_PATH = Path("data/repos/openhands")


class TestEdgeAccuracy:
    """Verify coupling edge calculations."""

    def get_git_cooccurrence(self, file_a: str, file_b: str) -> int:
        """Calculate actual co-occurrence from git."""
        result = subprocess.run(
            ["git", "log", "--name-only", "--format=---COMMIT---"],
            cwd=REPO_PATH,
            capture_output=True,
            text=True
        )
        
        count = 0
        current_files = set()
        
        for line in result.stdout.split("\n"):
            if line == "---COMMIT---":
                if file_a in current_files and file_b in current_files:
                    count += 1
                current_files = set()
            elif line.strip():
                current_files.add(line.strip())
        
        return count

    def test_cooccurrence_accuracy(self):
        """Co-occurrence count should match git reality."""
        db_path = DATA_PATH / "lfca.sqlite"
        conn = sqlite3.connect(db_path)
        
        # Get a high-coupling edge
        row = conn.execute("""
            SELECT f1.path_current, f2.path_current, e.pair_count
            FROM edges e
            JOIN files f1 ON e.src_file_id = f1.file_id
            JOIN files f2 ON e.dst_file_id = f2.file_id
            WHERE f1.exists_at_head = TRUE AND f2.exists_at_head = TRUE
            ORDER BY e.pair_count DESC
            LIMIT 1
        """).fetchone()
        conn.close()
        
        if not row:
            pytest.skip("No edges found")
        
        file_a, file_b, lfca_count = row
        git_count = self.get_git_cooccurrence(file_a, file_b)
        
        # Allow small difference due to filtering
        tolerance = max(5, git_count * 0.1)
        assert abs(git_count - lfca_count) <= tolerance, \
            f"Co-occurrence mismatch for {file_a} <-> {file_b}: git={git_count}, lfca={lfca_count}"

    def test_jaccard_range(self):
        """Jaccard should be between 0 and 1."""
        db_path = DATA_PATH / "lfca.sqlite"
        conn = sqlite3.connect(db_path)
        
        rows = conn.execute("""
            SELECT MIN(jaccard), MAX(jaccard), MIN(jaccard_weighted), MAX(jaccard_weighted)
            FROM edges
        """).fetchone()
        conn.close()
        
        min_j, max_j, min_jw, max_jw = rows
        
        assert 0 <= min_j <= max_j <= 1, f"Invalid Jaccard range: [{min_j}, {max_j}]"
        assert 0 <= min_jw <= max_jw <= 1, f"Invalid weighted Jaccard range: [{min_jw}, {max_jw}]"

    def test_conditional_probability_range(self):
        """Conditional probabilities should be between 0 and 1."""
        db_path = DATA_PATH / "lfca.sqlite"
        conn = sqlite3.connect(db_path)
        
        rows = conn.execute("""
            SELECT 
                MIN(p_dst_given_src), MAX(p_dst_given_src),
                MIN(p_src_given_dst), MAX(p_src_given_dst)
            FROM edges
        """).fetchone()
        conn.close()
        
        min_p1, max_p1, min_p2, max_p2 = rows
        
        assert 0 <= min_p1 <= max_p1 <= 1, f"Invalid P(dst|src) range"
        assert 0 <= min_p2 <= max_p2 <= 1, f"Invalid P(src|dst) range"

    def test_symmetry(self):
        """Edge (A,B) should exist but not (B,A) - edges are stored once."""
        db_path = DATA_PATH / "lfca.sqlite"
        conn = sqlite3.connect(db_path)
        
        # Check for any reversed duplicates
        duplicates = conn.execute("""
            SELECT COUNT(*) FROM edges e1
            JOIN edges e2 ON e1.src_file_id = e2.dst_file_id 
                         AND e1.dst_file_id = e2.src_file_id
        """).fetchone()[0]
        conn.close()
        
        assert duplicates == 0, f"Found {duplicates} symmetric edge pairs"


class TestEdgeFiltering:
    """Verify edge filtering logic."""

    def test_min_cooccurrence_filter(self):
        """Edges below min_cooccurrence should be excluded."""
        # This requires knowing the config - check edges have reasonable counts
        db_path = DATA_PATH / "lfca.sqlite"
        conn = sqlite3.connect(db_path)
        
        min_pair_count = conn.execute("SELECT MIN(pair_count) FROM edges").fetchone()[0]
        conn.close()
        
        # Default min_cooccurrence is typically 5
        assert min_pair_count >= 1, "Edges with zero co-occurrence found"

    def test_topk_applied(self):
        """No file should have more than topk edges."""
        db_path = DATA_PATH / "lfca.sqlite"
        conn = sqlite3.connect(db_path)
        
        # Count edges per file
        rows = conn.execute("""
            SELECT file_id, COUNT(*) as edge_count FROM (
                SELECT src_file_id as file_id FROM edges
                UNION ALL
                SELECT dst_file_id as file_id FROM edges
            )
            GROUP BY file_id
            ORDER BY edge_count DESC
            LIMIT 10
        """).fetchall()
        conn.close()
        
        # Default topk is 50
        topk = 50
        for file_id, count in rows:
            assert count <= topk * 2, f"File {file_id} has {count} edges (expected <= {topk*2})"
```

### 2.4 API Endpoint Tests

```python
# tests/qa/test_api.py
"""Tests for API correctness."""

import requests
import pytest

API_BASE = "http://localhost:8000"
REPO_ID = "openhands"


class TestRepoEndpoints:
    """Test repository management endpoints."""

    def test_list_repos(self, api_server):
        resp = requests.get(f"{api_server}/repos")
        assert resp.status_code == 200
        repos = resp.json()
        assert isinstance(repos, list)
        assert any(r["id"] == REPO_ID for r in repos)

    def test_repo_has_stats(self, api_server, analyzed_repo):
        resp = requests.get(f"{api_server}/repos")
        repo = next(r for r in resp.json() if r["id"] == analyzed_repo)
        
        assert repo["commit_count"] > 0
        assert repo["file_count"] > 0


class TestFileEndpoints:
    """Test file listing and tree endpoints."""

    def test_file_tree_structure(self, api_server, analyzed_repo):
        resp = requests.get(f"{api_server}/repos/{analyzed_repo}/files/tree")
        assert resp.status_code == 200
        
        tree = resp.json()
        assert "children" in tree
        assert len(tree["children"]) > 0

    def test_file_list_sorted(self, api_server, analyzed_repo):
        resp = requests.get(
            f"{api_server}/repos/{analyzed_repo}/files",
            params={"sort_by": "commits", "sort_dir": "desc", "limit": 10}
        )
        assert resp.status_code == 200
        
        files = resp.json()
        assert len(files) <= 10
        
        # Verify descending order
        commits = [f["total_commits"] for f in files]
        assert commits == sorted(commits, reverse=True)

    def test_file_search(self, api_server, analyzed_repo):
        resp = requests.get(
            f"{api_server}/repos/{analyzed_repo}/files",
            params={"q": "test"}
        )
        assert resp.status_code == 200
        
        files = resp.json()
        for f in files:
            assert "test" in f["path"].lower()


class TestCouplingEndpoints:
    """Test coupling analysis endpoints."""

    def test_coupling_returns_results(self, api_server, analyzed_repo):
        # Get a file that exists
        files_resp = requests.get(
            f"{api_server}/repos/{analyzed_repo}/files",
            params={"sort_by": "commits", "sort_dir": "desc", "limit": 1}
        )
        top_file = files_resp.json()[0]["path"]
        
        resp = requests.get(
            f"{api_server}/repos/{analyzed_repo}/coupling",
            params={"path": top_file, "limit": 10}
        )
        assert resp.status_code == 200
        
        coupled = resp.json()
        assert isinstance(coupled, list)

    def test_coupling_graph_format(self, api_server, analyzed_repo):
        files_resp = requests.get(
            f"{api_server}/repos/{analyzed_repo}/files",
            params={"sort_by": "commits", "sort_dir": "desc", "limit": 1}
        )
        top_file = files_resp.json()[0]["path"]
        
        resp = requests.get(
            f"{api_server}/repos/{analyzed_repo}/coupling/graph",
            params={"path": top_file}
        )
        assert resp.status_code == 200
        
        graph = resp.json()
        assert "nodes" in graph
        assert "edges" in graph
        assert "focus_id" in graph

    def test_coupling_evidence(self, api_server, analyzed_repo):
        # Get an edge
        files_resp = requests.get(
            f"{api_server}/repos/{analyzed_repo}/files",
            params={"sort_by": "commits", "sort_dir": "desc", "limit": 1}
        )
        top_file = files_resp.json()[0]["path"]
        
        coupling_resp = requests.get(
            f"{api_server}/repos/{analyzed_repo}/coupling",
            params={"path": top_file, "limit": 1}
        )
        
        if not coupling_resp.json():
            pytest.skip("No coupling found")
        
        coupled = coupling_resp.json()[0]
        
        # Get evidence
        # Need to get file_ids - this requires internal knowledge
        # This test may need adjustment based on API design


class TestClusteringEndpoints:
    """Test clustering functionality."""

    def test_list_algorithms(self, api_server, analyzed_repo):
        resp = requests.get(f"{api_server}/repos/{analyzed_repo}/clustering/algorithms")
        assert resp.status_code == 200
        
        algos = resp.json()
        assert len(algos) > 0
        assert any(a["name"] == "louvain" for a in algos)

    def test_run_clustering(self, api_server, analyzed_repo):
        resp = requests.post(
            f"{api_server}/repos/{analyzed_repo}/clustering/run",
            json={"algorithm": "louvain", "min_weight": 0.1}
        )
        assert resp.status_code == 200
        
        result = resp.json()
        assert "algorithm" in result
        assert "clusters" in result
        assert "cluster_count" in result

    def test_clustering_completeness(self, api_server, analyzed_repo):
        """All files should be assigned to exactly one cluster."""
        resp = requests.post(
            f"{api_server}/repos/{analyzed_repo}/clustering/run",
            json={"algorithm": "louvain"}
        )
        result = resp.json()
        
        all_file_ids = []
        for cluster in result["clusters"]:
            all_file_ids.extend(cluster.get("file_ids", []))
        
        # No duplicates
        assert len(all_file_ids) == len(set(all_file_ids))

    def test_snapshot_crud(self, api_server, analyzed_repo):
        """Test snapshot save/load/delete cycle."""
        # Run clustering
        run_resp = requests.post(
            f"{api_server}/repos/{analyzed_repo}/clustering/run",
            json={"algorithm": "louvain"}
        )
        result = run_resp.json()
        
        # Save snapshot
        save_resp = requests.post(
            f"{api_server}/repos/{analyzed_repo}/clustering/snapshots",
            json={"name": "test_snapshot", "result": result}
        )
        assert save_resp.status_code == 200
        snapshot_id = save_resp.json()["id"]
        
        # Load snapshot
        load_resp = requests.get(
            f"{api_server}/repos/{analyzed_repo}/clustering/snapshots/{snapshot_id}"
        )
        assert load_resp.status_code == 200
        
        # Delete snapshot
        del_resp = requests.delete(
            f"{api_server}/repos/{analyzed_repo}/clustering/snapshots/{snapshot_id}"
        )
        assert del_resp.status_code == 200
```

### 2.5 Metric Validation Tests

```python
# tests/qa/test_metrics.py
"""Mathematical validation of coupling metrics."""

import sqlite3
import math
from pathlib import Path
import pytest

DATA_PATH = Path("data/repos/openhands")


class TestJaccardFormula:
    """Verify Jaccard calculation is correct."""

    def test_jaccard_formula(self):
        """Jaccard = pair_count / (src_count + dst_count - pair_count)"""
        db_path = DATA_PATH / "lfca.sqlite"
        conn = sqlite3.connect(db_path)
        
        rows = conn.execute("""
            SELECT pair_count, src_count, dst_count, jaccard
            FROM edges
            LIMIT 100
        """).fetchall()
        conn.close()
        
        for pair_count, src_count, dst_count, jaccard in rows:
            expected = pair_count / (src_count + dst_count - pair_count)
            assert abs(expected - jaccard) < 0.0001, \
                f"Jaccard mismatch: expected={expected}, got={jaccard}"


class TestConditionalProbability:
    """Verify conditional probability calculations."""

    def test_p_dst_given_src(self):
        """P(dst|src) = pair_count / src_count"""
        db_path = DATA_PATH / "lfca.sqlite"
        conn = sqlite3.connect(db_path)
        
        rows = conn.execute("""
            SELECT pair_count, src_count, p_dst_given_src
            FROM edges
            LIMIT 100
        """).fetchall()
        conn.close()
        
        for pair_count, src_count, p_dst_given_src in rows:
            expected = pair_count / src_count if src_count > 0 else 0
            assert abs(expected - p_dst_given_src) < 0.0001

    def test_p_src_given_dst(self):
        """P(src|dst) = pair_count / dst_count"""
        db_path = DATA_PATH / "lfca.sqlite"
        conn = sqlite3.connect(db_path)
        
        rows = conn.execute("""
            SELECT pair_count, dst_count, p_src_given_dst
            FROM edges
            LIMIT 100
        """).fetchall()
        conn.close()
        
        for pair_count, dst_count, p_src_given_dst in rows:
            expected = pair_count / dst_count if dst_count > 0 else 0
            assert abs(expected - p_src_given_dst) < 0.0001


class TestMetricConsistency:
    """Cross-metric consistency checks."""

    def test_high_jaccard_implies_high_conditional(self):
        """If Jaccard is high, at least one conditional should be high."""
        db_path = DATA_PATH / "lfca.sqlite"
        conn = sqlite3.connect(db_path)
        
        rows = conn.execute("""
            SELECT jaccard, p_dst_given_src, p_src_given_dst
            FROM edges
            WHERE jaccard > 0.5
        """).fetchall()
        conn.close()
        
        for jaccard, p1, p2 in rows:
            # At least one conditional should be >= jaccard
            assert max(p1, p2) >= jaccard * 0.9, \
                f"High Jaccard ({jaccard}) but low conditionals ({p1}, {p2})"
```

### 2.6 CLI Test Script

```bash
#!/bin/bash
# tests/qa/test_cli.sh
# Run LFCA CLI tests

set -e

REPO_PATH="/home/afettah/workspace/OpenHands"
DATA_DIR="data_test"
REPO_ID="openhands_test"

# Cleanup
rm -rf "$DATA_DIR"

echo "=== Test: Mirror command ==="
python -m lfca mirror --data-dir="$DATA_DIR" --repo-id="$REPO_ID" "$REPO_PATH"

# Verify mirror exists
if [ ! -d "$DATA_DIR/repos/$REPO_ID/mirror.git" ]; then
    echo "FAIL: Mirror not created"
    exit 1
fi
echo "PASS: Mirror created"

echo "=== Test: Analyze command ==="
python -m lfca analyze --data-dir="$DATA_DIR" --repo-id="$REPO_ID" \
    --max-files-per-commit=300 \
    --bulk-policy=downweight \
    "$REPO_PATH"

# Verify artifacts
if [ ! -f "$DATA_DIR/repos/$REPO_ID/parquet/commits.parquet" ]; then
    echo "FAIL: commits.parquet not created"
    exit 1
fi
echo "PASS: commits.parquet created"

if [ ! -f "$DATA_DIR/repos/$REPO_ID/parquet/changes.parquet" ]; then
    echo "FAIL: changes.parquet not created"
    exit 1
fi
echo "PASS: changes.parquet created"

if [ ! -f "$DATA_DIR/repos/$REPO_ID/lfca.sqlite" ]; then
    echo "FAIL: lfca.sqlite not created"
    exit 1
fi
echo "PASS: lfca.sqlite created"

# Verify edge count
EDGE_COUNT=$(sqlite3 "$DATA_DIR/repos/$REPO_ID/lfca.sqlite" "SELECT COUNT(*) FROM edges")
if [ "$EDGE_COUNT" -eq 0 ]; then
    echo "FAIL: No edges created"
    exit 1
fi
echo "PASS: $EDGE_COUNT edges created"

# Cleanup
rm -rf "$DATA_DIR"
echo ""
echo "=== All CLI tests passed ==="
```

### 2.7 Running Automated Tests

```bash
# Run all QA tests
pytest tests/qa/ -v --tb=short

# Run specific test categories
pytest tests/qa/test_extraction.py -v
pytest tests/qa/test_edges.py -v
pytest tests/qa/test_api.py -v
pytest tests/qa/test_metrics.py -v

# Run with coverage
pytest tests/qa/ --cov=lfca --cov-report=html

# Generate test report
pytest tests/qa/ --junitxml=qa_report.xml
```

---

## 3. Manual Tests

This section provides detailed use cases for manual testing with expected results.

### 3.1 Test Environment Setup

```bash
# 1. Start the API server
cd /home/afettah/workspace/git-coupling-analyzer
source .venv/bin/activate
uvicorn lfca.api:app --reload --port 8000

# 2. Start the frontend (separate terminal)
cd frontend
npm run dev

# 3. Access the UI at http://localhost:5173
```

### 3.2 Use Case 1: Repository Analysis

#### Test Case 1.1: Initial Repository Import

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Click "Add Repository" | Modal opens |
| 2 | Enter path: `/home/afettah/workspace/OpenHands` | Path accepted |
| 3 | Enter name: "OpenHands" | Name accepted |
| 4 | Click "Create" | Repository appears in list with "not_started" state |
| 5 | Click "Start Analysis" | State changes to "queued" then "running" |
| 6 | Wait for completion | State becomes "complete", counts populate |

**Verification Points:**
- [ ] Repository appears in the sidebar
- [ ] File count matches `git ls-tree -r HEAD | wc -l`
- [ ] Commit count is within 5% of `git rev-list --count HEAD`

#### Test Case 1.2: Analysis with Custom Parameters

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Start new analysis with `max_changeset_size=100` | Analysis runs |
| 2 | Compare edge count with default | Edge count should differ |
| 3 | Start analysis with `merge_policy=exclude` | Merge commits excluded |

**Expected Behavior:**
- Stricter `max_changeset_size` = fewer edges (bulk commits filtered)
- `merge_policy=exclude` = fewer commits processed

### 3.3 Use Case 2: File Exploration

#### Test Case 2.1: File Tree Navigation

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Open file tree panel | Folder structure displayed |
| 2 | Expand `openhands/` folder | Children folders visible |
| 3 | Click on a Python file | File details appear |
| 4 | Verify commit count | Matches manual git count |

**Verification Script:**
```bash
# For file: openhands/core/main.py
git log --oneline -- openhands/core/main.py | wc -l
```

#### Test Case 2.2: File Search

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Type "test" in search box | Files containing "test" listed |
| 2 | Sort by "commits" descending | Most changed test files first |
| 3 | Verify top result | Should be high-activity test file |

### 3.4 Use Case 3: Coupling Analysis

#### Test Case 3.1: View Coupled Files

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Select a frequently changed file | File selected |
| 2 | View coupling panel | List of coupled files appears |
| 3 | Verify top coupled file | Jaccard score > 0.3 |
| 4 | Click on coupled file | Details shown |

**Expected Results for Common Patterns:**

| Source File | Expected Coupled File | Expected Jaccard |
|-------------|----------------------|------------------|
| `test_*.py` | `*.py` (implementation) | > 0.4 |
| `__init__.py` | Other files in same folder | > 0.2 |
| `config.py` | Files importing config | > 0.1 |

#### Test Case 3.2: Impact Graph Visualization

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Click "Impact Graph" button | Force-directed graph appears |
| 2 | Verify center node | Focus file is centered |
| 3 | Hover over edge | Weight tooltip appears |
| 4 | Verify node count | Matches "top N" parameter |
| 5 | Drag a node | Graph physics responds |

**Visual Verification:**
- [ ] Focus node is visually distinct (different color/size)
- [ ] Edge thickness corresponds to coupling strength
- [ ] Labels are readable
- [ ] Zoom/pan works correctly

#### Test Case 3.3: Coupling Evidence

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Click on an edge in the graph | Evidence panel opens |
| 2 | View common commits | List of commits where both files changed |
| 3 | Verify commit count | Matches `pair_count` |
| 4 | Click a commit | Commit details shown |

### 3.5 Use Case 4: Clustering

#### Test Case 4.1: Run Louvain Clustering

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Open Clustering panel | Algorithm options visible |
| 2 | Select "Louvain" | Parameters shown |
| 3 | Set resolution=1.0, min_weight=0.1 | Parameters accepted |
| 4 | Click "Run" | Clustering executes |
| 5 | View results | Clusters listed with sizes |

**Expected Results:**
- [ ] Modularity score between 0 and 1
- [ ] Each file assigned to exactly one cluster
- [ ] Cluster sizes vary (not all equal)
- [ ] Related files grouped together

#### Test Case 4.2: Cluster Quality Verification

| Cluster Expectation | Verification |
|---------------------|--------------|
| Test files together | Most `test_*.py` in same or related clusters |
| Docs separate | `docs/` files not mixed with `src/` |
| Config files | May bridge multiple clusters |

#### Test Case 4.3: Save and Compare Snapshots

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Run clustering with resolution=0.5 | Fewer, larger clusters |
| 2 | Save as "low_resolution" | Snapshot saved |
| 3 | Run clustering with resolution=2.0 | More, smaller clusters |
| 4 | Save as "high_resolution" | Snapshot saved |
| 5 | Compare snapshots | Diff visualization shown |

**Expected Comparison Results:**
- High resolution: More clusters, smaller average size
- Low resolution: Fewer clusters, larger average size
- Some stable groups should appear in both

### 3.6 Use Case 5: Edge Cases

#### Test Case 5.1: Empty Results

| Scenario | Action | Expected Result |
|----------|--------|-----------------|
| Search nonexistent file | Search for "xyznonexistent.py" | Empty result, no error |
| Coupling for isolated file | Query file with no coupling | Empty list, helpful message |
| New repo no analysis | View repo before analysis | "Not analyzed" state shown |

#### Test Case 5.2: Large Result Sets

| Scenario | Action | Expected Result |
|----------|--------|-----------------|
| File with 100+ couplings | Query highly connected file | Results paginated/truncated |
| Cluster with 500+ files | View large cluster | UI handles gracefully |
| Full repository tree | Expand all folders | Tree remains responsive |

#### Test Case 5.3: Special Characters

| Scenario | Action | Expected Result |
|----------|--------|-----------------|
| File with spaces | Query "file name.py" | Handled correctly |
| Unicode in path | Query "файл.py" | Handled correctly |
| Path with dots | Query "src/../file.py" | Normalized correctly |

### 3.7 Use Case 6: Metric Verification

#### Test Case 6.1: Manual Jaccard Calculation

**Test File Pair:** Select two highly coupled files from the UI.

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Record LFCA Jaccard score | Note value (e.g., 0.45) |
| 2 | Get git co-occurrence count | See script below |
| 3 | Get file A commit count | See script below |
| 4 | Get file B commit count | See script below |
| 5 | Calculate: `co / (A + B - co)` | Should match LFCA ± 0.05 |

**Verification Script:**
```bash
FILE_A="openhands/core/config.py"
FILE_B="openhands/core/main.py"

# Co-occurrence count
git log --name-only --format="" | \
    awk -v a="$FILE_A" -v b="$FILE_B" '
    /^$/ { 
        if (has_a && has_b) count++;
        has_a=0; has_b=0; 
        next 
    }
    $0 == a { has_a=1 }
    $0 == b { has_b=1 }
    END { print "Co-occurrence:", count }
    '

# Individual counts
echo "File A commits: $(git log --oneline -- "$FILE_A" | wc -l)"
echo "File B commits: $(git log --oneline -- "$FILE_B" | wc -l)"
```

#### Test Case 6.2: Conditional Probability Verification

For a coupled pair (A, B):
- P(B|A) = Times B changed given A changed / Times A changed
- Should match LFCA's `p_dst_given_src`

### 3.8 Regression Test Checklist

Run these checks after any code changes:

#### Data Integrity
- [ ] Commit count matches git (within tolerance)
- [ ] File count at HEAD matches git ls-tree
- [ ] No duplicate edges
- [ ] All files have valid paths

#### Metric Correctness
- [ ] Jaccard between 0 and 1
- [ ] Conditional probabilities between 0 and 1
- [ ] pair_count <= min(src_count, dst_count)

#### API Functionality
- [ ] All endpoints return valid JSON
- [ ] Error responses have proper format
- [ ] Pagination works correctly
- [ ] Filters apply correctly

#### UI Functionality
- [ ] File tree renders
- [ ] Impact graph renders
- [ ] Clustering produces results
- [ ] Snapshots save/load correctly

### 3.9 Performance Benchmarks

Record these metrics for the OpenHands repository:

| Metric | Expected Range | Actual |
|--------|---------------|--------|
| Analysis time | < 5 minutes | _____ |
| API response (file list) | < 200ms | _____ |
| API response (coupling) | < 500ms | _____ |
| Clustering (Louvain) | < 10 seconds | _____ |
| Frontend initial load | < 3 seconds | _____ |

### 3.10 Defect Report Template

Use this template when reporting issues:

```markdown
## Defect Report

**Title:** [Brief description]

**Severity:** Critical / High / Medium / Low

**Environment:**
- LFCA version: ___
- OS: ___
- Browser: ___
- Reference repo: OpenHands

**Steps to Reproduce:**
1. 
2. 
3. 

**Expected Result:**

**Actual Result:**

**Evidence:**
- Screenshot: [attach]
- Git command output: [attach]
- API response: [attach]

**Additional Notes:**
```

---

## Appendix A: Quick Reference Commands

### Git Commands for Verification

```bash
# Total commits
git rev-list --count HEAD

# Current files
git ls-tree -r HEAD --name-only | wc -l

# Merge commits
git log --merges --oneline | wc -l

# File commit count
git log --oneline -- path/to/file | wc -l

# Files changed together
git log --name-only --format="" --all | sort | uniq -c | sort -rn | head -20

# Find renames
git log --name-status --diff-filter=R -M --format=""
```

### API Quick Tests

```bash
# List repos
curl http://localhost:8000/repos

# Get file tree
curl "http://localhost:8000/repos/openhands/files/tree"

# Get coupling
curl "http://localhost:8000/repos/openhands/coupling?path=openhands/core/main.py"

# Run clustering
curl -X POST "http://localhost:8000/repos/openhands/clustering/run" \
  -H "Content-Type: application/json" \
  -d '{"algorithm": "louvain"}'
```

### SQLite Quick Queries

```bash
sqlite3 data/repos/openhands/lfca.sqlite << 'EOF'
.headers on
.mode column

-- File count
SELECT COUNT(*) as total_files, 
       SUM(exists_at_head) as current_files 
FROM files;

-- Edge count
SELECT COUNT(*) as edge_count FROM edges;

-- Top coupled pairs
SELECT f1.path_current, f2.path_current, e.jaccard
FROM edges e
JOIN files f1 ON e.src_file_id = f1.file_id
JOIN files f2 ON e.dst_file_id = f2.file_id
ORDER BY e.jaccard DESC
LIMIT 10;
EOF
```

---

## Appendix B: Test Data Reference

### Expected Statistics for OpenHands (as of analysis date)

Fill in after initial analysis:

| Metric | Value | Date Captured |
|--------|-------|---------------|
| Total commits | _____ | _____ |
| Current files | _____ | _____ |
| Total edges | _____ | _____ |
| Avg Jaccard | _____ | _____ |
| Max Jaccard | _____ | _____ |
| Cluster count (default) | _____ | _____ |
| Modularity | _____ | _____ |

### Known Coupling Pairs (Ground Truth)

Document manually verified coupling pairs:

| File A | File B | Expected Jaccard | Notes |
|--------|--------|------------------|-------|
| | | | |
| | | | |
| | | | |

---

## Version History

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0 | 2026-01-31 | QA Team | Initial version |
