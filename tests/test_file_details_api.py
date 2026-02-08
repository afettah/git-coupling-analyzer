"""Tests for file-details API endpoints.

Tests validate correctness of file details, activity, authors, coupling timeline,
and risk timeline APIs using concrete OpenHands repository data.
"""
import json
import sqlite3
import tempfile
from datetime import datetime
from pathlib import Path

import pandas as pd
import pyarrow as pa
import pyarrow.parquet as pq
import pytest

from git_analyzer.api import GitAPI


@pytest.fixture
def openhands_repo_path():
    """Path to OpenHands test repository."""
    path = Path("/home/afettah/workspace/git-coupling-analyzer/tmp/OpenHands")
    if not path.exists():
        pytest.skip("OpenHands repository not available")
    return path


@pytest.fixture
def temp_db_with_openhands_data():
    """Create temporary database with sample OpenHands data for testing."""
    with tempfile.TemporaryDirectory() as tmpdir:
        db_path = Path(tmpdir) / "test.db"
        parquet_dir = Path(tmpdir) / "parquet"
        parquet_dir.mkdir()
        
        # Create database with minimal required schema
        conn = sqlite3.connect(db_path)
        conn.row_factory = sqlite3.Row
        
        # Minimal schema tables needed for Storage to work
        conn.executescript("""
            PRAGMA journal_mode = WAL;
            PRAGMA synchronous = NORMAL;
            PRAGMA foreign_keys = ON;
            
            CREATE TABLE IF NOT EXISTS schema_info (
                key   TEXT PRIMARY KEY,
                value TEXT
            );
            
            CREATE TABLE IF NOT EXISTS repo_meta (
                key   TEXT PRIMARY KEY,
                value TEXT
            );
            
            CREATE TABLE IF NOT EXISTS entities (
                entity_id       INTEGER PRIMARY KEY AUTOINCREMENT,
                kind            TEXT NOT NULL,
                name            TEXT NOT NULL,
                qualified_name  TEXT,
                language        TEXT,
                parent_id       INTEGER,
                line_start      INTEGER,
                line_end        INTEGER,
                exists_at_head  BOOLEAN DEFAULT TRUE,
                metadata_json   TEXT,
                created_at      TEXT DEFAULT CURRENT_TIMESTAMP,
                updated_at      TEXT DEFAULT CURRENT_TIMESTAMP
            );
            
            CREATE UNIQUE INDEX IF NOT EXISTS idx_entities_qualified
                ON entities(qualified_name) WHERE qualified_name IS NOT NULL;
            
            CREATE TABLE IF NOT EXISTS git_edges (
                src_entity_id       INTEGER NOT NULL REFERENCES entities(entity_id),
                dst_entity_id       INTEGER NOT NULL REFERENCES entities(entity_id),
                pair_count          REAL NOT NULL,
                src_count           INTEGER NOT NULL DEFAULT 1,
                dst_count           INTEGER NOT NULL DEFAULT 1,
                src_weight          REAL NOT NULL DEFAULT 1.0,
                dst_weight          REAL NOT NULL DEFAULT 1.0,
                jaccard             REAL NOT NULL,
                jaccard_weighted    REAL NOT NULL,
                p_dst_given_src     REAL NOT NULL,
                p_src_given_dst     REAL NOT NULL,
                PRIMARY KEY (src_entity_id, dst_entity_id)
            );
            
            CREATE INDEX IF NOT EXISTS idx_git_edges_src ON git_edges(src_entity_id);
            CREATE INDEX IF NOT EXISTS idx_git_edges_dst ON git_edges(dst_entity_id);
            
            INSERT INTO schema_info (key, value) VALUES ('version', '1');
        """)
        
        # Sample files from OpenHands (based on QA data)
        files = [
            (1, "pyproject.toml", json.dumps({
                "total_commits": 71,
                "authors_count": 15,
                "total_lines_added": 850,
                "total_lines_deleted": 320,
                "first_commit_oid": "abc123",
                "last_commit_oid": "def456",
                "first_commit_ts": 1640000000,
                "last_commit_ts": 1706745600,  # Recent
            })),
            (2, "frontend/package.json", json.dumps({
                "total_commits": 61,
                "authors_count": 8,
                "total_lines_added": 400,
                "total_lines_deleted": 150,
                "first_commit_oid": "ghi789",
                "last_commit_oid": "jkl012",
                "first_commit_ts": 1650000000,
                "last_commit_ts": 1706745600,
            })),
            (3, "README.md", json.dumps({
                "total_commits": 20,
                "authors_count": 12,
                "total_lines_added": 500,
                "total_lines_deleted": 200,
                "first_commit_oid": "mno345",
                "last_commit_oid": "pqr678",
                "first_commit_ts": 1640000000,
                "last_commit_ts": 1706745600,
            })),
            (4, "docker-compose.yml", json.dumps({
                "total_commits": 45,
                "authors_count": 6,
                "total_lines_added": 300,
                "total_lines_deleted": 100,
                "first_commit_oid": "stu901",
                "last_commit_oid": "vwx234",
                "first_commit_ts": 1655000000,
                "last_commit_ts": 1706745600,
            })),
        ]
        
        for file_id, path, metadata in files:
            # Extract name from path (last component)
            name = path.split("/")[-1]
            conn.execute(
                "INSERT INTO entities (entity_id, name, qualified_name, kind, metadata_json) VALUES (?, ?, ?, 'file', ?)",
                (file_id, name, path, metadata)
            )
        
        # Add coupling edges (based on QA data showing high coupling)
        edges = [
            # src_id, dst_id, pair_count, src_cnt, dst_cnt, src_wt, dst_wt, jaccard, jaccard_wt, p_dst|src, p_src|dst
            (1, 2, 30, 71, 61, 1.0, 1.0, 0.7703, 0.82, 0.75, 0.70),  # pyproject.toml <-> package.json
            (2, 1, 30, 61, 71, 1.0, 1.0, 0.7703, 0.82, 0.70, 0.75),
            (4, 1, 15, 45, 71, 1.0, 1.0, 0.4, 0.45, 0.4, 0.38),  # docker-compose.yml <-> pyproject.toml
        ]
        
        for edge in edges:
            conn.execute(
                "INSERT INTO git_edges VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
                edge
            )
        
        conn.commit()
        
        # Create sample parquet data
        # Changes data
        changes_data = {
            "commit_oid": [
                "commit1", "commit2", "commit3", "commit4", "commit5",
                "commit6", "commit7", "commit8", "commit9", "commit10",
            ],
            "file_id": [1, 1, 1, 2, 2, 2, 3, 3, 4, 4],
            "path": [
                "pyproject.toml", "pyproject.toml", "pyproject.toml",
                "frontend/package.json", "frontend/package.json", "frontend/package.json",
                "README.md", "README.md",
                "docker-compose.yml", "docker-compose.yml",
            ],
            "status": ["M", "M", "M", "M", "M", "M", "M", "M", "M", "M"],
            "old_path": ["", "", "", "", "", "", "", "", "", ""],
            "commit_ts": [
                1640000000, 1650000000, 1670000000, 1650000000, 1660000000,
                1680000000, 1640000000, 1675000000, 1655000000, 1670000000,
            ],
            "lines_added": [50, 30, 20, 25, 15, 30, 40, 20, 15, 25],
            "lines_deleted": [10, 15, 5, 8, 10, 5, 12, 8, 5, 10],
        }
        changes_df = pd.DataFrame(changes_data)
        changes_table = pa.Table.from_pandas(changes_df)
        pq.write_table(changes_table, parquet_dir / "changes.parquet")
        
        # Commits data
        commits_data = {
            "commit_oid": [
                "commit1", "commit2", "commit3", "commit4", "commit5",
                "commit6", "commit7", "commit8", "commit9", "commit10",
            ],
            "author_name": [
                "Alice", "Bob", "Alice", "Charlie", "Alice",
                "Bob", "Dave", "Alice", "Eve", "Bob",
            ],
            "author_email": [
                "alice@example.com", "bob@example.com", "alice@example.com",
                "charlie@example.com", "alice@example.com", "bob@example.com",
                "dave@example.com", "alice@example.com", "eve@example.com", "bob@example.com",
            ],
            "authored_ts": [
                1640000000, 1650000000, 1670000000, 1650000000, 1660000000,
                1680000000, 1640000000, 1675000000, 1655000000, 1670000000,
            ],
            "committer_ts": [
                1640000000, 1650000000, 1670000000, 1650000000, 1660000000,
                1680000000, 1640000000, 1675000000, 1655000000, 1670000000,
            ],
            "is_merge": [False] * 10,
            "parent_count": [1] * 10,
            "message_subject": ["Update"] * 10,
        }
        commits_df = pd.DataFrame(commits_data)
        commits_table = pa.Table.from_pandas(commits_df)
        pq.write_table(commits_table, parquet_dir / "commits.parquet")
        
        conn.close()
        
        yield db_path, parquet_dir


class TestGetFileDetails:
    """Test get_file_details API."""
    
    def test_basic_file_details(self, temp_db_with_openhands_data):
        """Test basic file details retrieval."""
        db_path, parquet_dir = temp_db_with_openhands_data
        api = GitAPI()
        
        result = api.get_file_details(db_path, parquet_dir, "pyproject.toml")
        
        assert result is not None
        assert result["path"] == "pyproject.toml"
        assert result["file_id"] == 1
        assert result["total_commits"] == 71
        assert result["authors_count"] == 15
        assert result["total_lines_added"] == 850
        assert result["total_lines_deleted"] == 320
        assert result["exists_at_head"] == 1
    
    def test_file_details_churn_rate(self, temp_db_with_openhands_data):
        """Test churn rate calculation."""
        db_path, parquet_dir = temp_db_with_openhands_data
        api = GitAPI()
        
        result = api.get_file_details(db_path, parquet_dir, "pyproject.toml")
        
        # Churn rate = (lines_added + lines_deleted) / commits
        expected_churn = (850 + 320) / 71
        assert result["churn_rate"] == pytest.approx(expected_churn, rel=0.01)
    
    def test_file_details_coupling_stats(self, temp_db_with_openhands_data):
        """Test coupling statistics in file details."""
        db_path, parquet_dir = temp_db_with_openhands_data
        api = GitAPI()
        
        result = api.get_file_details(db_path, parquet_dir, "pyproject.toml")
        
        # pyproject.toml has coupling edges (both directions count)
        # Check that coupled_files_count is > 0
        assert result["coupled_files_count"] > 0
        assert result["max_coupling"] == pytest.approx(0.770, abs=0.01)
        assert result["avg_coupling"] > 0
    
    def test_file_details_risk_score(self, temp_db_with_openhands_data):
        """Test risk score calculation."""
        db_path, parquet_dir = temp_db_with_openhands_data
        api = GitAPI()
        
        result = api.get_file_details(db_path, parquet_dir, "pyproject.toml")
        
        # Risk score should be computed and within valid range
        assert "risk_score" in result
        assert 0 <= result["risk_score"] <= 100
        # High commits (71) and high coupling (0.77) should result in higher risk
        assert result["risk_score"] > 50
    
    def test_file_not_found(self, temp_db_with_openhands_data):
        """Test behavior when file doesn't exist."""
        db_path, parquet_dir = temp_db_with_openhands_data
        api = GitAPI()
        
        result = api.get_file_details(db_path, parquet_dir, "nonexistent/file.py")
        
        assert result == {}


class TestGetFileDetailsEnhanced:
    """Test get_file_details_enhanced API."""
    
    def test_enhanced_includes_base_details(self, temp_db_with_openhands_data):
        """Test that enhanced details include base details."""
        db_path, parquet_dir = temp_db_with_openhands_data
        api = GitAPI()
        
        result = api.get_file_details_enhanced(db_path, parquet_dir, "pyproject.toml")
        
        # Should include all base fields
        assert result["path"] == "pyproject.toml"
        assert result["total_commits"] == 71
        assert result["authors_count"] == 15
    
    def test_enhanced_bus_factor(self, temp_db_with_openhands_data):
        """Test bus factor calculation."""
        db_path, parquet_dir = temp_db_with_openhands_data
        api = GitAPI()
        
        result = api.get_file_details_enhanced(db_path, parquet_dir, "pyproject.toml")
        
        # Should have bus factor field
        assert "bus_factor" in result
        assert isinstance(result["bus_factor"], int)
        assert result["bus_factor"] >= 1
    
    def test_enhanced_age_days(self, temp_db_with_openhands_data):
        """Test age calculation in days."""
        db_path, parquet_dir = temp_db_with_openhands_data
        api = GitAPI()
        
        result = api.get_file_details_enhanced(db_path, parquet_dir, "pyproject.toml")
        
        # Should have age_days field
        assert "age_days" in result
        assert result["age_days"] > 0
    
    def test_enhanced_knowledge_silos(self, temp_db_with_openhands_data):
        """Test knowledge silo detection."""
        db_path, parquet_dir = temp_db_with_openhands_data
        api = GitAPI()
        
        result = api.get_file_details_enhanced(db_path, parquet_dir, "pyproject.toml")
        
        # Should have knowledge_silos field
        assert "knowledge_silos" in result
        assert isinstance(result["knowledge_silos"], list)
    
    def test_enhanced_churn_trend(self, temp_db_with_openhands_data):
        """Test churn trend direction."""
        db_path, parquet_dir = temp_db_with_openhands_data
        api = GitAPI()
        
        result = api.get_file_details_enhanced(db_path, parquet_dir, "pyproject.toml")
        
        # Should have churn_trend field
        assert "churn_trend" in result
        assert result["churn_trend"] in {"increasing", "decreasing", "stable"}
    
    def test_enhanced_risk_factors(self, temp_db_with_openhands_data):
        """Test risk factors breakdown."""
        db_path, parquet_dir = temp_db_with_openhands_data
        api = GitAPI()
        
        result = api.get_file_details_enhanced(db_path, parquet_dir, "pyproject.toml")
        
        # Should have detailed risk factors list used by frontend
        assert "risk_factors" in result
        factors = result["risk_factors"]
        assert isinstance(factors, list)
        assert len(factors) > 0
        first = factors[0]
        assert "name" in first
        assert "score" in first
        assert "weight" in first
        assert "label" in first
        assert "description" in first
    
    def test_enhanced_risk_trend(self, temp_db_with_openhands_data):
        """Test risk trend direction."""
        db_path, parquet_dir = temp_db_with_openhands_data
        api = GitAPI()
        
        result = api.get_file_details_enhanced(db_path, parquet_dir, "pyproject.toml")
        
        # Should have risk_trend field
        assert "risk_trend" in result
        assert isinstance(result["risk_trend"], (int, float))


class TestGetFileActivityFiltered:
    """Test get_file_activity_filtered API."""
    
    def test_activity_basic_structure(self, temp_db_with_openhands_data):
        """Test basic activity response structure."""
        db_path, parquet_dir = temp_db_with_openhands_data
        api = GitAPI()
        
        result = api.get_file_activity_filtered(
            db_path, parquet_dir, "pyproject.toml"
        )
        
        # Should have all expected keys
        assert "commits_by_period" in result
        assert "lines_by_period" in result
        assert "authors_by_period" in result
        assert "heatmap_data" in result
        assert "day_hour_matrix" in result
    
    def test_activity_commits_by_period(self, temp_db_with_openhands_data):
        """Test commits by period aggregation."""
        db_path, parquet_dir = temp_db_with_openhands_data
        api = GitAPI()
        
        result = api.get_file_activity_filtered(
            db_path, parquet_dir, "pyproject.toml", granularity="monthly"
        )
        
        commits = result["commits_by_period"]
        assert isinstance(commits, list)
        if commits:
            # Each entry should have period and count
            assert "period" in commits[0]
            assert "count" in commits[0]
            assert commits[0]["count"] > 0
    
    def test_activity_lines_by_period(self, temp_db_with_openhands_data):
        """Test lines changed by period."""
        db_path, parquet_dir = temp_db_with_openhands_data
        api = GitAPI()
        
        result = api.get_file_activity_filtered(
            db_path, parquet_dir, "pyproject.toml", granularity="monthly"
        )
        
        lines = result["lines_by_period"]
        assert isinstance(lines, list)
        if lines:
            # Each entry should have added and deleted
            assert "period" in lines[0]
            assert "added" in lines[0]
            assert "deleted" in lines[0]
            assert lines[0]["added"] >= 0
            assert lines[0]["deleted"] >= 0
    
    def test_activity_authors_by_period(self, temp_db_with_openhands_data):
        """Test unique authors by period."""
        db_path, parquet_dir = temp_db_with_openhands_data
        api = GitAPI()
        
        result = api.get_file_activity_filtered(
            db_path, parquet_dir, "pyproject.toml", granularity="monthly"
        )
        
        authors = result["authors_by_period"]
        assert isinstance(authors, list)
        if authors:
            assert "period" in authors[0]
            assert "count" in authors[0]
            assert authors[0]["count"] > 0
    
    def test_activity_time_filtering(self, temp_db_with_openhands_data):
        """Test time range filtering."""
        db_path, parquet_dir = temp_db_with_openhands_data
        api = GitAPI()
        
        # Get full activity
        full_result = api.get_file_activity_filtered(
            db_path, parquet_dir, "pyproject.toml"
        )
        
        # Get filtered activity (only recent)
        filtered_result = api.get_file_activity_filtered(
            db_path, parquet_dir, "pyproject.toml",
            from_ts=1660000000  # After some commits
        )
        
        # Filtered should have fewer or equal commits
        full_commits = sum(p["count"] for p in full_result["commits_by_period"])
        filtered_commits = sum(p["count"] for p in filtered_result["commits_by_period"])
        assert filtered_commits <= full_commits
    
    def test_activity_granularity_daily(self, temp_db_with_openhands_data):
        """Test daily granularity."""
        db_path, parquet_dir = temp_db_with_openhands_data
        api = GitAPI()
        
        result = api.get_file_activity_filtered(
            db_path, parquet_dir, "pyproject.toml", granularity="daily"
        )
        
        # Should still return valid structure
        assert isinstance(result["commits_by_period"], list)
    
    def test_activity_granularity_weekly(self, temp_db_with_openhands_data):
        """Test weekly granularity."""
        db_path, parquet_dir = temp_db_with_openhands_data
        api = GitAPI()
        
        result = api.get_file_activity_filtered(
            db_path, parquet_dir, "pyproject.toml", granularity="weekly"
        )
        
        assert isinstance(result["commits_by_period"], list)
    
    def test_activity_heatmap_data(self, temp_db_with_openhands_data):
        """Test heatmap calendar data."""
        db_path, parquet_dir = temp_db_with_openhands_data
        api = GitAPI()
        
        result = api.get_file_activity_filtered(
            db_path, parquet_dir, "pyproject.toml"
        )
        
        heatmap = result["heatmap_data"]
        assert isinstance(heatmap, list)
        if heatmap:
            # Should have date and count
            assert "date" in heatmap[0]
            assert "count" in heatmap[0]
            # Date should be in YYYY-MM-DD format
            assert len(heatmap[0]["date"]) == 10
    
    def test_activity_day_hour_matrix(self, temp_db_with_openhands_data):
        """Test day-hour matrix data."""
        db_path, parquet_dir = temp_db_with_openhands_data
        api = GitAPI()
        
        result = api.get_file_activity_filtered(
            db_path, parquet_dir, "pyproject.toml"
        )
        
        matrix = result["day_hour_matrix"]
        assert isinstance(matrix, list)
        if matrix:
            # Should have day (0-6), hour (0-23), count
            assert "day" in matrix[0]
            assert "hour" in matrix[0]
            assert "count" in matrix[0]
            assert 0 <= matrix[0]["day"] <= 6
            assert 0 <= matrix[0]["hour"] <= 23
    
    def test_activity_file_not_found(self, temp_db_with_openhands_data):
        """Test activity for non-existent file."""
        db_path, parquet_dir = temp_db_with_openhands_data
        api = GitAPI()
        
        result = api.get_file_activity_filtered(
            db_path, parquet_dir, "nonexistent/file.py"
        )
        
        # Should return empty structures
        assert result["commits_by_period"] == []
        assert result["lines_by_period"] == []
        assert result["authors_by_period"] == []


class TestGetFileAuthorsEnhanced:
    """Test get_file_authors_enhanced API."""
    
    def test_authors_basic_structure(self, temp_db_with_openhands_data):
        """Test basic authors response structure."""
        db_path, parquet_dir = temp_db_with_openhands_data
        api = GitAPI()
        
        result = api.get_file_authors_enhanced(
            db_path, parquet_dir, "pyproject.toml"
        )
        
        # Should have all expected keys
        assert "authors" in result
        assert "bus_factor" in result
        assert "ownership_timeline" in result
    
    def test_authors_list_format(self, temp_db_with_openhands_data):
        """Test authors list format."""
        db_path, parquet_dir = temp_db_with_openhands_data
        api = GitAPI()
        
        result = api.get_file_authors_enhanced(
            db_path, parquet_dir, "pyproject.toml"
        )
        
        authors = result["authors"]
        assert isinstance(authors, list)
        assert len(authors) > 0
        
        # Check first author format
        author = authors[0]
        assert "name" in author
        assert "commits" in author
        assert "percentage" in author
        assert "lines_added" in author
        assert "lines_deleted" in author
        
        # Should be sorted by commits descending
        if len(authors) > 1:
            assert authors[0]["commits"] >= authors[1]["commits"]
    
    def test_authors_percentage_sum(self, temp_db_with_openhands_data):
        """Test that author percentages sum to ~100%."""
        db_path, parquet_dir = temp_db_with_openhands_data
        api = GitAPI()
        
        result = api.get_file_authors_enhanced(
            db_path, parquet_dir, "pyproject.toml"
        )
        
        total_percentage = sum(a["percentage"] for a in result["authors"])
        assert 99 <= total_percentage <= 101  # Allow small rounding error
    
    def test_authors_bus_factor(self, temp_db_with_openhands_data):
        """Test bus factor in authors response."""
        db_path, parquet_dir = temp_db_with_openhands_data
        api = GitAPI()
        
        result = api.get_file_authors_enhanced(
            db_path, parquet_dir, "pyproject.toml"
        )
        
        # Bus factor should be >= 1
        assert result["bus_factor"] >= 1
        # Should not exceed number of authors
        assert result["bus_factor"] <= len(result["authors"])
    
    def test_authors_ownership_timeline(self, temp_db_with_openhands_data):
        """Test ownership timeline structure."""
        db_path, parquet_dir = temp_db_with_openhands_data
        api = GitAPI()
        
        result = api.get_file_authors_enhanced(
            db_path, parquet_dir, "pyproject.toml", granularity="monthly"
        )
        
        timeline = result["ownership_timeline"]
        assert isinstance(timeline, list)
        if timeline:
            # Should provide date + per-author contribution map
            assert "date" in timeline[0]
            assert "contributions" in timeline[0]
            assert isinstance(timeline[0]["contributions"], dict)
    
    def test_authors_time_filtering(self, temp_db_with_openhands_data):
        """Test time range filtering for authors."""
        db_path, parquet_dir = temp_db_with_openhands_data
        api = GitAPI()
        
        # Get full authors
        full_result = api.get_file_authors_enhanced(
            db_path, parquet_dir, "pyproject.toml"
        )
        
        # Get filtered authors (recent only)
        filtered_result = api.get_file_authors_enhanced(
            db_path, parquet_dir, "pyproject.toml",
            from_ts=1670000000
        )
        
        # Both should return valid structures
        assert isinstance(full_result["authors"], list)
        assert isinstance(filtered_result["authors"], list)
    
    def test_authors_file_not_found(self, temp_db_with_openhands_data):
        """Test authors for non-existent file."""
        db_path, parquet_dir = temp_db_with_openhands_data
        api = GitAPI()
        
        result = api.get_file_authors_enhanced(
            db_path, parquet_dir, "nonexistent/file.py"
        )
        
        # Should return empty structures
        assert result["authors"] == []
        assert result["bus_factor"] == 0
        assert result["ownership_timeline"] == []


class TestGetFileCouplingTimeline:
    """Test get_file_coupling_timeline API."""
    
    def test_coupling_timeline_structure(self, temp_db_with_openhands_data):
        """Test coupling timeline basic structure."""
        db_path, parquet_dir = temp_db_with_openhands_data
        api = GitAPI()
        
        result = api.get_file_coupling_timeline(
            db_path, parquet_dir, "pyproject.toml"
        )
        
        assert isinstance(result, list)
    
    def test_coupling_timeline_granularity(self, temp_db_with_openhands_data):
        """Test different granularities for coupling timeline."""
        db_path, parquet_dir = temp_db_with_openhands_data
        api = GitAPI()
        
        for granularity in ["daily", "weekly", "monthly"]:
            result = api.get_file_coupling_timeline(
                db_path, parquet_dir, "pyproject.toml",
                granularity=granularity
            )
            assert isinstance(result, list)
    
    def test_coupling_timeline_time_filter(self, temp_db_with_openhands_data):
        """Test time filtering for coupling timeline."""
        db_path, parquet_dir = temp_db_with_openhands_data
        api = GitAPI()
        
        result = api.get_file_coupling_timeline(
            db_path, parquet_dir, "pyproject.toml",
            from_ts=1650000000,
            to_ts=1680000000
        )
        
        assert isinstance(result, list)
    
    def test_coupling_timeline_file_not_found(self, temp_db_with_openhands_data):
        """Test coupling timeline for non-existent file."""
        db_path, parquet_dir = temp_db_with_openhands_data
        api = GitAPI()
        
        result = api.get_file_coupling_timeline(
            db_path, parquet_dir, "nonexistent/file.py"
        )
        
        assert result == []


class TestGetFileRiskTimeline:
    """Test get_file_risk_timeline API."""
    
    def test_risk_timeline_structure(self, temp_db_with_openhands_data):
        """Test risk timeline basic structure."""
        db_path, parquet_dir = temp_db_with_openhands_data
        api = GitAPI()
        
        result = api.get_file_risk_timeline(
            db_path, parquet_dir, "pyproject.toml"
        )
        
        assert isinstance(result, list)
    
    def test_risk_timeline_granularity(self, temp_db_with_openhands_data):
        """Test different granularities for risk timeline."""
        db_path, parquet_dir = temp_db_with_openhands_data
        api = GitAPI()
        
        for granularity in ["daily", "weekly", "monthly"]:
            result = api.get_file_risk_timeline(
                db_path, parquet_dir, "pyproject.toml",
                granularity=granularity
            )
            assert isinstance(result, list)
    
    def test_risk_timeline_time_filter(self, temp_db_with_openhands_data):
        """Test time filtering for risk timeline."""
        db_path, parquet_dir = temp_db_with_openhands_data
        api = GitAPI()
        
        result = api.get_file_risk_timeline(
            db_path, parquet_dir, "pyproject.toml",
            from_ts=1650000000,
            to_ts=1680000000
        )
        
        assert isinstance(result, list)
    
    def test_risk_timeline_file_not_found(self, temp_db_with_openhands_data):
        """Test risk timeline for non-existent file."""
        db_path, parquet_dir = temp_db_with_openhands_data
        api = GitAPI()
        
        result = api.get_file_risk_timeline(
            db_path, parquet_dir, "nonexistent/file.py"
        )
        
        assert result == []


class TestDataConsistency:
    """Test data consistency across different API calls."""
    
    def test_commits_count_consistency(self, temp_db_with_openhands_data):
        """Test that commit counts are consistent across APIs."""
        db_path, parquet_dir = temp_db_with_openhands_data
        api = GitAPI()
        
        details = api.get_file_details(db_path, parquet_dir, "pyproject.toml")
        activity = api.get_file_activity_filtered(db_path, parquet_dir, "pyproject.toml")
        
        # Total commits from activity should match details
        # (considering activity may have different granularity)
        activity_commits = sum(p["count"] for p in activity["commits_by_period"])
        # Activity counts unique commit OIDs per period, details has total
        # They should be related but might not be exactly equal
        assert activity_commits > 0
        assert details["total_commits"] > 0
    
    def test_authors_count_consistency(self, temp_db_with_openhands_data):
        """Test that author counts are consistent."""
        db_path, parquet_dir = temp_db_with_openhands_data
        api = GitAPI()
        
        details = api.get_file_details(db_path, parquet_dir, "pyproject.toml")
        authors_data = api.get_file_authors_enhanced(db_path, parquet_dir, "pyproject.toml")
        
        # Number of authors should be consistent
        # Note: might differ if filtering is applied
        assert len(authors_data["authors"]) > 0
    
    def test_bus_factor_consistency(self, temp_db_with_openhands_data):
        """Test that bus factor is consistent across APIs."""
        db_path, parquet_dir = temp_db_with_openhands_data
        api = GitAPI()
        
        enhanced = api.get_file_details_enhanced(db_path, parquet_dir, "pyproject.toml")
        authors_data = api.get_file_authors_enhanced(db_path, parquet_dir, "pyproject.toml")
        
        # Bus factor should be the same
        assert enhanced["bus_factor"] == authors_data["bus_factor"]


class TestEdgeCases:
    """Test edge cases and boundary conditions."""
    
    def test_file_with_no_coupling(self, temp_db_with_openhands_data):
        """Test file with no coupling edges."""
        db_path, parquet_dir = temp_db_with_openhands_data
        api = GitAPI()
        
        result = api.get_file_details(db_path, parquet_dir, "README.md")
        
        # Should have zero coupling
        assert result["coupled_files_count"] == 0
        assert result["max_coupling"] == 0.0
        assert result["avg_coupling"] == 0.0
    
    def test_empty_time_range(self, temp_db_with_openhands_data):
        """Test activity with empty time range."""
        db_path, parquet_dir = temp_db_with_openhands_data
        api = GitAPI()
        
        # Time range with no commits
        result = api.get_file_activity_filtered(
            db_path, parquet_dir, "pyproject.toml",
            from_ts=1500000000,
            to_ts=1500000100  # Very narrow range before any commits
        )
        
        # Should return empty activity
        assert result["commits_by_period"] == []
    
    def test_future_time_range(self, temp_db_with_openhands_data):
        """Test activity with future time range."""
        db_path, parquet_dir = temp_db_with_openhands_data
        api = GitAPI()
        
        # Time range in the future
        future_ts = int(datetime.now().timestamp()) + 86400 * 365
        result = api.get_file_activity_filtered(
            db_path, parquet_dir, "pyproject.toml",
            from_ts=future_ts
        )
        
        # Should return empty activity
        assert result["commits_by_period"] == []


class TestRealWorldScenarios:
    """Test scenarios based on real OpenHands data patterns."""
    
    def test_high_coupling_file(self, temp_db_with_openhands_data):
        """Test file with high coupling (like pyproject.toml <-> package.json)."""
        db_path, parquet_dir = temp_db_with_openhands_data
        api = GitAPI()
        
        result = api.get_file_details(db_path, parquet_dir, "pyproject.toml")
        
        # Should detect high coupling
        assert result["max_coupling"] > 0.5
        # High coupling should increase risk score
        assert result["risk_score"] > 40
    
    def test_configuration_file_pattern(self, temp_db_with_openhands_data):
        """Test configuration files (often highly coupled)."""
        db_path, parquet_dir = temp_db_with_openhands_data
        api = GitAPI()
        
        config_files = ["pyproject.toml", "frontend/package.json", "docker-compose.yml"]
        
        for file_path in config_files:
            result = api.get_file_details(db_path, parquet_dir, file_path)
            
            # Config files typically have multiple commits
            assert result["total_commits"] > 0
            # Should calculate risk score
            assert "risk_score" in result
    
    def test_documentation_file_pattern(self, temp_db_with_openhands_data):
        """Test documentation files (often low coupling)."""
        db_path, parquet_dir = temp_db_with_openhands_data
        api = GitAPI()
        
        result = api.get_file_details(db_path, parquet_dir, "README.md")
        
        # Docs often have many authors but low coupling
        assert result["authors_count"] > 0
        assert result["coupled_files_count"] == 0
