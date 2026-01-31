#!/usr/bin/env python3
"""
API Test Data Collector for QA Validation

Collects detailed responses from all LFCA API endpoints for manual verification
against ground truth data.

Usage:
    python QA/scripts/api_test_collector.py --repo openhands --base-url http://localhost:8000
"""

import argparse
import json
import requests
from datetime import datetime
from pathlib import Path


def api_get(base_url: str, endpoint: str, params: dict = None) -> dict:
    """Make a GET request and return JSON response."""
    url = f"{base_url}{endpoint}"
    try:
        resp = requests.get(url, params=params, timeout=30)
        resp.raise_for_status()
        return {"status": resp.status_code, "data": resp.json()}
    except requests.RequestException as e:
        return {"status": getattr(e.response, "status_code", 0), "error": str(e)}


def api_post(base_url: str, endpoint: str, payload: dict = None) -> dict:
    """Make a POST request and return JSON response."""
    url = f"{base_url}{endpoint}"
    try:
        resp = requests.post(url, json=payload, timeout=60)
        resp.raise_for_status()
        return {"status": resp.status_code, "data": resp.json()}
    except requests.RequestException as e:
        return {"status": getattr(e.response, "status_code", 0), "error": str(e)}


def collect_repository_info(base_url: str, repo_id: str) -> dict:
    """Collect repository-level information."""
    print("  📦 Repository Info...")
    
    # List repositories
    repos = api_get(base_url, "/repos")
    
    # Get file tree
    tree = api_get(base_url, f"/repos/{repo_id}/files/tree")
    
    # Get folders at different depths
    folders_d1 = api_get(base_url, f"/repos/{repo_id}/folders", {"depth": 1})
    folders_d2 = api_get(base_url, f"/repos/{repo_id}/folders", {"depth": 2})
    folders_d3 = api_get(base_url, f"/repos/{repo_id}/folders", {"depth": 3})
    
    return {
        "repos_list": repos,
        "file_tree_summary": {
            "status": tree.get("status"),
            "has_children": "children" in tree.get("data", {}),
            "root_name": tree.get("data", {}).get("name")
        },
        "folders": {
            "depth_1": folders_d1,
            "depth_2": folders_d2,
            "depth_3": folders_d3,
        }
    }


def collect_file_info(base_url: str, repo_id: str) -> dict:
    """Collect file listing and statistics."""
    print("  📄 File Listings...")
    
    # All current files (limited)
    files_current = api_get(base_url, f"/repos/{repo_id}/files", {
        "current_only": True,
        "limit": 500,
        "sort_by": "path"
    })
    
    # Top files by commits
    files_hot = api_get(base_url, f"/repos/{repo_id}/files", {
        "current_only": True,
        "limit": 100,
        "sort_by": "commits",
        "sort_dir": "desc"
    })
    
    # Files in specific folders
    files_openhands = api_get(base_url, f"/repos/{repo_id}/files", {
        "q": "openhands/",
        "limit": 200
    })
    
    files_frontend = api_get(base_url, f"/repos/{repo_id}/files", {
        "q": "frontend/",
        "limit": 200
    })
    
    files_tests = api_get(base_url, f"/repos/{repo_id}/files", {
        "q": "tests/",
        "limit": 200
    })
    
    # Include deleted files
    files_all = api_get(base_url, f"/repos/{repo_id}/files", {
        "current_only": False,
        "limit": 500
    })
    
    return {
        "current_files": files_current,
        "hottest_files": files_hot,
        "openhands_folder": files_openhands,
        "frontend_folder": files_frontend,
        "tests_folder": files_tests,
        "all_files_with_deleted": files_all,
        "summary": {
            "current_count": len(files_current.get("data", [])) if "data" in files_current else 0,
            "with_deleted_count": len(files_all.get("data", [])) if "data" in files_all else 0,
            "openhands_count": len(files_openhands.get("data", [])) if "data" in files_openhands else 0,
            "frontend_count": len(files_frontend.get("data", [])) if "data" in files_frontend else 0,
            "tests_count": len(files_tests.get("data", [])) if "data" in files_tests else 0,
        }
    }


def collect_coupling_info(base_url: str, repo_id: str, test_files: list) -> dict:
    """Collect coupling data for test files."""
    print("  🔗 Coupling Data...")
    
    results = {}
    for file_path in test_files:
        print(f"    - {file_path}")
        
        # Get coupling with different metrics
        coupling_jaccard = api_get(base_url, f"/repos/{repo_id}/coupling", {
            "path": file_path,
            "metric": "jaccard",
            "min_weight": 0.0,
            "limit": 50
        })
        
        coupling_weighted = api_get(base_url, f"/repos/{repo_id}/coupling", {
            "path": file_path,
            "metric": "jaccard_weighted",
            "min_weight": 0.0,
            "limit": 50
        })
        
        # Get coupling graph
        coupling_graph = api_get(base_url, f"/repos/{repo_id}/coupling/graph", {
            "path": file_path,
            "metric": "jaccard",
            "min_weight": 0.1,
            "limit": 20
        })
        
        results[file_path] = {
            "jaccard": coupling_jaccard,
            "jaccard_weighted": coupling_weighted,
            "graph": coupling_graph
        }
    
    return results


def collect_file_history(base_url: str, repo_id: str, test_files: list) -> dict:
    """Collect file history data."""
    print("  📜 File History...")
    
    results = {}
    for file_path in test_files:
        print(f"    - {file_path}")
        
        history = api_get(base_url, f"/repos/{repo_id}/files/{file_path}/history", {
            "limit": 50
        })
        
        results[file_path] = history
    
    return results


def collect_evidence(base_url: str, repo_id: str, file_pairs: list) -> dict:
    """Collect coupling evidence for file pairs."""
    print("  📋 Coupling Evidence...")
    
    results = []
    for src_path, dst_path in file_pairs:
        print(f"    - {src_path} <-> {dst_path}")
        
        # First get file IDs
        src_info = api_get(base_url, f"/repos/{repo_id}/files", {
            "q": src_path,
            "limit": 1
        })
        
        dst_info = api_get(base_url, f"/repos/{repo_id}/files", {
            "q": dst_path,
            "limit": 1
        })
        
        src_id = None
        dst_id = None
        
        if "data" in src_info and src_info["data"]:
            for f in src_info["data"]:
                if f["path"] == src_path:
                    src_id = f["file_id"]
                    break
        
        if "data" in dst_info and dst_info["data"]:
            for f in dst_info["data"]:
                if f["path"] == dst_path:
                    dst_id = f["file_id"]
                    break
        
        evidence = None
        if src_id and dst_id:
            evidence = api_get(base_url, f"/repos/{repo_id}/coupling/evidence", {
                "src_id": src_id,
                "dst_id": dst_id,
                "limit": 20
            })
        
        results.append({
            "src_path": src_path,
            "dst_path": dst_path,
            "src_id": src_id,
            "dst_id": dst_id,
            "evidence": evidence
        })
    
    return results


def collect_component_coupling(base_url: str, repo_id: str, components: list) -> dict:
    """Collect component-level coupling."""
    print("  📁 Component Coupling...")
    
    results = {}
    for component in components:
        print(f"    - {component}")
        
        coupling = api_get(base_url, f"/repos/{repo_id}/coupling/components", {
            "component": component,
            "depth": 2,
            "limit": 20
        })
        
        results[component] = coupling
    
    return results


def collect_clustering_info(base_url: str, repo_id: str, folders: list = None) -> dict:
    """Collect clustering results."""
    print("  🧩 Clustering...")
    
    # List available algorithms
    algorithms = api_get(base_url, f"/repos/{repo_id}/clustering/algorithms")
    
    # Run clustering with different algorithms
    clustering_results = {}
    
    for algo in ["louvain", "spectral", "hierarchical"]:
        print(f"    - Running {algo}...")
        
        payload = {
            "algorithm": algo,
            "weight_column": "jaccard",
            "min_weight": 0.1,
            "folders": folders or [],
            "params": {}
        }
        
        result = api_post(base_url, f"/repos/{repo_id}/clustering/run", payload)
        clustering_results[algo] = result
    
    # List snapshots
    snapshots = api_get(base_url, f"/repos/{repo_id}/clustering/snapshots")
    
    return {
        "available_algorithms": algorithms,
        "clustering_results": clustering_results,
        "saved_snapshots": snapshots
    }


def collect_analysis_status(base_url: str, repo_id: str) -> dict:
    """Collect analysis status."""
    print("  ⚙️ Analysis Status...")
    
    status = api_get(base_url, f"/repos/{repo_id}/analysis/status")
    
    return status


def main():
    parser = argparse.ArgumentParser(description="Collect API test data for QA")
    parser.add_argument("--repo", required=True, help="Repository ID")
    parser.add_argument("--base-url", default="http://localhost:8000", help="API base URL")
    parser.add_argument("--output-dir", default="QA/output", help="Output directory")
    args = parser.parse_args()
    
    repo_id = args.repo
    base_url = args.base_url
    output_dir = Path(args.output_dir) / repo_id / "api_tests"
    output_dir.mkdir(parents=True, exist_ok=True)
    
    print(f"\n🔍 Collecting API test data for repository: {repo_id}")
    print(f"   Base URL: {base_url}")
    print(f"   Output: {output_dir}\n")
    
    # Test files for coupling analysis (based on ground truth)
    test_files = [
        # High coupling expected
        "frontend/package.json",
        "frontend/package-lock.json",
        "poetry.lock",
        "pyproject.toml",
        "frontend/src/i18n/translation.json",
        "frontend/src/i18n/declaration.ts",
        # Core files
        "openhands/llm/llm.py",
        "openhands/controller/agent_controller.py",
        "openhands/runtime/base.py",
        "openhands/server/session/session.py",
        # Test files (for test-impl coupling)
        "tests/unit/test_agent_controller.py",
        "tests/unit/test_config.py",
    ]
    
    # File pairs for evidence collection (known high-coupling pairs)
    file_pairs = [
        ("frontend/package.json", "frontend/package-lock.json"),
        ("poetry.lock", "pyproject.toml"),
        ("frontend/src/i18n/translation.json", "frontend/src/i18n/declaration.ts"),
        ("containers/dev/compose.yml", "docker-compose.yml"),
        ("Development.md", "containers/dev/compose.yml"),
    ]
    
    # Components for component-level coupling
    components = [
        "openhands",
        "frontend",
        "tests",
        "evaluation",
        "enterprise",
        "openhands/server",
        "openhands/runtime",
        "frontend/src",
    ]
    
    # Folders for clustering
    clustering_folders = ["openhands", "frontend/src"]
    
    # Collect data
    results = {
        "metadata": {
            "repo_id": repo_id,
            "base_url": base_url,
            "collection_time": datetime.now().isoformat(),
        }
    }
    
    try:
        results["repository_info"] = collect_repository_info(base_url, repo_id)
        results["file_info"] = collect_file_info(base_url, repo_id)
        results["coupling_data"] = collect_coupling_info(base_url, repo_id, test_files)
        results["file_history"] = collect_file_history(base_url, repo_id, test_files[:5])
        results["coupling_evidence"] = collect_evidence(base_url, repo_id, file_pairs)
        results["component_coupling"] = collect_component_coupling(base_url, repo_id, components)
        results["clustering"] = collect_clustering_info(base_url, repo_id, clustering_folders)
        results["analysis_status"] = collect_analysis_status(base_url, repo_id)
    except Exception as e:
        results["error"] = str(e)
        print(f"\n❌ Error during collection: {e}")
    
    # Save full results
    output_file = output_dir / "full_api_results.json"
    with open(output_file, "w") as f:
        json.dump(results, f, indent=2)
    print(f"\n✅ Full results saved to: {output_file}")
    
    # Save individual endpoint results
    for key, value in results.items():
        if key != "metadata":
            endpoint_file = output_dir / f"{key}.json"
            with open(endpoint_file, "w") as f:
                json.dump(value, f, indent=2)
    
    # Generate summary report
    generate_summary(results, output_dir)
    
    print(f"\n📊 Collection complete!")


def generate_summary(results: dict, output_dir: Path) -> None:
    """Generate a human-readable summary of the API results."""
    
    summary_lines = [
        "# API Test Results Summary",
        "",
        f"**Collection Time:** {results['metadata']['collection_time']}",
        f"**Repository:** {results['metadata']['repo_id']}",
        f"**API Base URL:** {results['metadata']['base_url']}",
        "",
        "---",
        "",
    ]
    
    # Repository Info
    if "repository_info" in results:
        info = results["repository_info"]
        summary_lines.extend([
            "## 1. Repository Info",
            "",
        ])
        
        if "repos_list" in info and "data" in info["repos_list"]:
            repos = info["repos_list"]["data"]
            if repos:
                repo = next((r for r in repos if r["id"] == results["metadata"]["repo_id"]), None)
                if repo:
                    summary_lines.extend([
                        f"- **State:** {repo.get('state', 'N/A')}",
                        f"- **File Count:** {repo.get('file_count', 0):,}",
                        f"- **Commit Count:** {repo.get('commit_count', 0):,}",
                    ])
        
        if "folders" in info:
            for depth, data in info["folders"].items():
                if "data" in data:
                    summary_lines.append(f"- **Folders at {depth}:** {len(data['data'])}")
        
        summary_lines.append("")
    
    # File Info
    if "file_info" in results:
        info = results["file_info"]
        summary_lines.extend([
            "## 2. File Information",
            "",
        ])
        
        if "summary" in info:
            s = info["summary"]
            summary_lines.extend([
                f"- **Current Files (limited):** {s.get('current_count', 0)}",
                f"- **With Deleted (limited):** {s.get('with_deleted_count', 0)}",
                f"- **openhands/ folder:** {s.get('openhands_count', 0)}",
                f"- **frontend/ folder:** {s.get('frontend_count', 0)}",
                f"- **tests/ folder:** {s.get('tests_count', 0)}",
            ])
        
        # Top hottest files
        if "hottest_files" in info and "data" in info["hottest_files"]:
            hot = info["hottest_files"]["data"][:10]
            summary_lines.extend([
                "",
                "### Top 10 Hottest Files",
                "",
                "| File | Commits |",
                "|------|---------|",
            ])
            for f in hot:
                summary_lines.append(f"| {f['path'][:60]} | {f['total_commits']} |")
        
        summary_lines.append("")
    
    # Coupling Data
    if "coupling_data" in results:
        summary_lines.extend([
            "## 3. Coupling Analysis",
            "",
        ])
        
        for file_path, data in results["coupling_data"].items():
            summary_lines.append(f"### {file_path}")
            
            if "jaccard" in data and "data" in data["jaccard"]:
                edges = data["jaccard"]["data"][:5]
                if edges:
                    summary_lines.extend([
                        "",
                        "| Coupled File | Jaccard | Pair Count |",
                        "|--------------|---------|------------|",
                    ])
                    for e in edges:
                        summary_lines.append(f"| {e['path'][:50]} | {e['jaccard']:.4f} | {e['pair_count']} |")
            
            summary_lines.append("")
    
    # Coupling Evidence
    if "coupling_evidence" in results:
        summary_lines.extend([
            "## 4. Coupling Evidence",
            "",
        ])
        
        for pair in results["coupling_evidence"]:
            src = pair.get("src_path", "?")
            dst = pair.get("dst_path", "?")
            evidence = pair.get("evidence", {})
            
            summary_lines.append(f"### {src} ↔ {dst}")
            
            if evidence and "data" in evidence:
                commits = evidence["data"].get("commits", [])
                summary_lines.append(f"- **Common Commits:** {len(commits)}")
                if commits:
                    summary_lines.extend([
                        "",
                        "| Date | Author | Subject |",
                        "|------|--------|---------|",
                    ])
                    for c in commits[:5]:
                        date = c.get("authored_ts", "")[:10] if c.get("authored_ts") else "?"
                        author = c.get("author_name", "?")[:20]
                        subject = c.get("message_subject", "?")[:50]
                        summary_lines.append(f"| {date} | {author} | {subject} |")
            
            summary_lines.append("")
    
    # Clustering
    if "clustering" in results:
        summary_lines.extend([
            "## 5. Clustering Results",
            "",
        ])
        
        clustering = results["clustering"]
        
        if "available_algorithms" in clustering and "data" in clustering["available_algorithms"]:
            algos = clustering["available_algorithms"]["data"]
            summary_lines.append(f"**Available Algorithms:** {', '.join(a['name'] for a in algos)}")
            summary_lines.append("")
        
        if "clustering_results" in clustering:
            for algo, result in clustering["clustering_results"].items():
                summary_lines.append(f"### {algo.title()}")
                
                if "data" in result:
                    data = result["data"]
                    summary_lines.extend([
                        f"- **Cluster Count:** {data.get('cluster_count', 0)}",
                    ])
                    
                    # Top clusters by size
                    clusters = data.get("clusters", [])
                    if clusters:
                        clusters_sorted = sorted(clusters, key=lambda c: c.get("size", 0), reverse=True)[:5]
                        summary_lines.extend([
                            "",
                            "| Cluster ID | Size | Avg Coupling |",
                            "|------------|------|--------------|",
                        ])
                        for c in clusters_sorted:
                            cluster_id = str(c.get('id', '?'))[:30]
                            summary_lines.append(
                                f"| {cluster_id} | {c.get('size', 0)} | {c.get('avg_coupling', 0):.4f} |"
                            )
                elif "error" in result:
                    summary_lines.append(f"- **Error:** {result['error']}")
                
                summary_lines.append("")
    
    # Component Coupling
    if "component_coupling" in results:
        summary_lines.extend([
            "## 6. Component Coupling",
            "",
        ])
        
        for component, data in results["component_coupling"].items():
            summary_lines.append(f"### {component}")
            
            if "data" in data:
                coupled = data["data"].get("coupled_components", [])[:5]
                if coupled:
                    summary_lines.extend([
                        "",
                        "| Component | Jaccard | File Pairs |",
                        "|-----------|---------|------------|",
                    ])
                    for c in coupled:
                        summary_lines.append(
                            f"| {c['component'][:40]} | {c['jaccard']:.4f} | {c['file_pair_count']} |"
                        )
            
            summary_lines.append("")
    
    # Analysis Status
    if "analysis_status" in results:
        summary_lines.extend([
            "## 7. Analysis Status",
            "",
        ])
        
        status = results["analysis_status"]
        if "data" in status:
            for key, value in status["data"].items():
                summary_lines.append(f"- **{key}:** {value}")
        
        summary_lines.append("")
    
    # Write summary
    summary_file = output_dir / "API_TEST_SUMMARY.md"
    with open(summary_file, "w") as f:
        f.write("\n".join(summary_lines))
    
    print(f"📝 Summary saved to: {summary_file}")


if __name__ == "__main__":
    main()
