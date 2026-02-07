#!/usr/bin/env python3
"""Quick validation script to test the fixed API."""

import sys
from pathlib import Path
import uuid
import shutil

# Add src to path
sys.path.insert(0, str(Path(__file__).parent.parent / "src" / "git-analyzer"))
sys.path.insert(0, str(Path(__file__).parent.parent / "src" / "platform"))

from git_analyzer.api import GitAPI
from code_intel.config import RepoPaths


def generate_random_name() -> str:
    """Generate a random test repository ID."""
    return f"test-api-{uuid.uuid4().hex[:8]}"


def test_api():
    """Test key API methods."""
    print("🔍 Testing Git Analyzer API...")
    
    # Setup - try to find an existing analyzed repo
    data_dir = Path(__file__).parent.parent / "data"
    repos_dir = data_dir / "repos"
    
    # Find first repo with a database
    repo_id = None
    if repos_dir.exists():
        for repo_path in repos_dir.iterdir():
            if repo_path.is_dir():
                test_db = repo_path / "code-intel.sqlite"
                if test_db.exists():
                    repo_id = repo_path.name
                    break
    
    if not repo_id:
        print(f"❌ No analyzed repos found in {repos_dir}")
        print(f"   Please run analysis on a repo first")
        print(f"   Example: python tests/test_e2e_analysis.py")
        return False
    
    print(f"   Using repo: {repo_id}")
    paths = RepoPaths(data_dir, repo_id)
    
    api = GitAPI()
    
    # Test 1: Get coupling for a file (use any file from the repo)
    print("\n📊 Test 1: get_file_coupling")
    try:
        # Get the first file from the database
        import sqlite3
        conn = sqlite3.connect(paths.db_path)
        cursor = conn.cursor()
        cursor.execute("SELECT path FROM git_file_lineage WHERE path IS NOT NULL LIMIT 1")
        row = cursor.fetchone()
        conn.close()
        
        if not row:
            print("   ⚠️  No files found in database")
        else:
            test_file = row[0]
            result = api.get_file_coupling(
                paths.db_path,
                test_file,
                metric="jaccard",
                min_weight=0.5,
                limit=5
            )
            print(f"   ✅ Found {len(result)} coupled files for {test_file}")
            if result:
                print(f"   Top match: {result[0]['path']} (jaccard={result[0]['jaccard']})")
    except Exception as e:
        print(f"   ❌ Error: {e}")
        return False
    
    # Test 2: Dashboard summary
    print("\n📈 Test 2: get_dashboard_summary")
    try:
        summary = api.get_dashboard_summary(paths.db_path, paths.parquet_dir)
        print(f"   ✅ Files: {summary['file_count']}")
        print(f"   ✅ Commits: {summary['commit_count']}")
        print(f"   ✅ Authors: {summary['totalAuthors']}")
        print(f"   ✅ Avg Coupling: {summary['avgCoupling']}")
    except Exception as e:
        print(f"   ❌ Error: {e}")
        return False
    
    # Test 3: Hotspots
    print("\n🔥 Test 3: get_hotspots")
    try:
        hotspots = api.get_hotspots(
            paths.db_path,
            paths.parquet_dir,
            limit=5,
            sort_by="risk_score"
        )
        print(f"   ✅ Found {len(hotspots)} hotspots")
        if hotspots:
            top = hotspots[0]
            print(f"   Top hotspot: {top['path']}")
            print(f"   - Risk Score: {top['riskScore']}")
            print(f"   - Commits: {top['total_commits']}")
            print(f"   - Authors: {top['authors']}")
    except Exception as e:
        print(f"   ❌ Error: {e}")
        return False
    
    # Test 4: Coupling graph
    print("\n🕸️  Test 4: get_coupling_graph")
    try:
        # Use root path or empty string for full graph
        graph = api.get_coupling_graph(
            paths.db_path,
            "",
            metric="jaccard",
            min_weight=0.5,
            limit=50
        )
        print(f"   ✅ Nodes: {len(graph['nodes'])}")
        print(f"   ✅ Edges: {len(graph['edges'])}")
    except Exception as e:
        print(f"   ❌ Error: {e}")
        return False
    
    # Test 5: File details
    print("\n📄 Test 5: get_file_details")
    try:
        # Get a file from the database
        import sqlite3
        conn = sqlite3.connect(paths.db_path)
        cursor = conn.cursor()
        cursor.execute("SELECT path FROM git_file_lineage WHERE path IS NOT NULL LIMIT 1")
        row = cursor.fetchone()
        conn.close()
        
        if not row:
            print("   ⚠️  No files found in database")
        else:
            test_file = row[0]
            details = api.get_file_details(
                paths.db_path,
                paths.parquet_dir,
                test_file
            )
            if details:
                print(f"   ✅ File: {test_file}")
                print(f"   ✅ File ID: {details['file_id']}")
                print(f"   ✅ Commits: {details['total_commits']}")
                print(f"   ✅ Authors: {details['authors_count']}")
                print(f"   ✅ Risk Score: {details['risk_score']}")
                print(f"   ✅ Coupled Files: {details['coupled_files_count']}")
            else:
                print(f"   ⚠️  File not found in database")
    except Exception as e:
        print(f"   ❌ Error: {e}")
        return False
    
    print("\n✅ All tests passed!")
    return True


if __name__ == "__main__":
    success = test_api()
    sys.exit(0 if success else 1)
