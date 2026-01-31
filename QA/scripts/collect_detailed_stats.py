#!/usr/bin/env python3
"""
Collect detailed statistics for individual files and clusters.

Usage:
    python QA/scripts/collect_detailed_stats.py --repo openhands
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
        return resp.json()
    except requests.RequestException as e:
        return {"error": str(e)}


def api_post(base_url: str, endpoint: str, payload: dict = None) -> dict:
    """Make a POST request and return JSON response."""
    url = f"{base_url}{endpoint}"
    try:
        resp = requests.post(url, json=payload, timeout=60)
        resp.raise_for_status()
        return resp.json()
    except requests.RequestException as e:
        return {"error": str(e)}


def collect_file_details(base_url: str, repo_id: str, output_dir: Path) -> None:
    """Collect detailed info for each file."""
    print("\n📄 Collecting file details...")
    
    # Get all files sorted by commits
    files = api_get(base_url, f"/repos/{repo_id}/files", {
        "current_only": True,
        "limit": 500,
        "sort_by": "commits",
        "sort_dir": "desc"
    })
    
    if "error" in files:
        print(f"  ❌ Error: {files['error']}")
        return
    
    file_details = []
    for i, file_info in enumerate(files[:100]):  # Top 100 files
        file_id = file_info["file_id"]
        path = file_info["path"]
        commits = file_info["total_commits"]
        
        if i % 20 == 0:
            print(f"  Processing file {i+1}/{min(100, len(files))}...")
        
        # Get coupling for this file
        coupling = api_get(base_url, f"/repos/{repo_id}/coupling", {
            "path": path,
            "metric": "jaccard",
            "limit": 10,
            "min_weight": 0.0
        })
        
        coupled_count = len(coupling) if not isinstance(coupling, dict) or "error" not in coupling else 0
        top_coupling = coupling[0]["jaccard"] if coupled_count > 0 else 0
        top_coupled_file = coupling[0]["path"] if coupled_count > 0 else None
        
        file_details.append({
            "file_id": file_id,
            "path": path,
            "total_commits": commits,
            "exists_at_head": file_info["exists_at_head"],
            "coupled_file_count": coupled_count,
            "top_coupling_score": top_coupling,
            "top_coupled_file": top_coupled_file,
            "coupled_files": coupling[:5] if isinstance(coupling, list) else []
        })
    
    # Save file details
    output_file = output_dir / "file_details.json"
    with open(output_file, "w") as f:
        json.dump({
            "collected_at": datetime.now().isoformat(),
            "file_count": len(file_details),
            "files": file_details
        }, f, indent=2)
    
    print(f"  ✅ Saved {len(file_details)} file details to {output_file}")
    
    # Create summary CSV
    csv_file = output_dir / "file_details.csv"
    with open(csv_file, "w") as f:
        f.write("file_id,path,commits,coupled_count,top_coupling,top_coupled_file\n")
        for fd in file_details:
            top_file = fd.get("top_coupled_file", "") or ""
            f.write(f'{fd["file_id"]},"{fd["path"]}",{fd["total_commits"]},'
                   f'{fd["coupled_file_count"]},{fd["top_coupling_score"]:.4f},"{top_file}"\n')
    
    print(f"  ✅ Saved CSV to {csv_file}")


def collect_cluster_details(base_url: str, repo_id: str, output_dir: Path) -> None:
    """Run clustering and collect detailed cluster info."""
    print("\n🧩 Collecting cluster details...")
    
    # Run Louvain clustering with different parameters
    clustering_runs = [
        {"algorithm": "louvain", "min_weight": 0.1, "folders": []},
        {"algorithm": "louvain", "min_weight": 0.05, "folders": []},
        {"algorithm": "louvain", "min_weight": 0.1, "folders": ["openhands"]},
        {"algorithm": "louvain", "min_weight": 0.1, "folders": ["frontend/src"]},
        {"algorithm": "hierarchical", "min_weight": 0.1, "folders": []},
        {"algorithm": "label_propagation", "min_weight": 0.1, "folders": []},
    ]
    
    all_results = {}
    
    for run in clustering_runs:
        name = f"{run['algorithm']}_mw{run['min_weight']}_{'_'.join(run['folders']) or 'all'}"
        print(f"  Running {name}...")
        
        payload = {
            "algorithm": run["algorithm"],
            "weight_column": "jaccard",
            "min_weight": run["min_weight"],
            "folders": run["folders"],
            "params": {}
        }
        
        result = api_post(base_url, f"/repos/{repo_id}/clustering/run", payload)
        
        if "error" in result:
            print(f"    ❌ Error: {result['error']}")
            all_results[name] = {"error": result["error"]}
            continue
        
        # Analyze clusters
        clusters = result.get("clusters", [])
        
        cluster_analysis = {
            "algorithm": run["algorithm"],
            "min_weight": run["min_weight"],
            "folders": run["folders"],
            "cluster_count": result.get("cluster_count", 0),
            "total_files": sum(c.get("size", 0) for c in clusters),
            "singleton_count": sum(1 for c in clusters if c.get("size", 0) == 1),
            "largest_cluster_size": max((c.get("size", 0) for c in clusters), default=0),
            "avg_cluster_size": (
                sum(c.get("size", 0) for c in clusters) / len(clusters) if clusters else 0
            ),
            "avg_coupling": (
                sum(c.get("avg_coupling", 0) for c in clusters) / len(clusters) if clusters else 0
            ),
            "clusters": [
                {
                    "id": c.get("id"),
                    "size": c.get("size", 0),
                    "avg_coupling": c.get("avg_coupling", 0),
                    "files": c.get("files", [])[:10],  # First 10 files only
                    "file_ids": c.get("file_ids", [])
                }
                for c in sorted(clusters, key=lambda x: x.get("size", 0), reverse=True)[:20]
            ]
        }
        
        all_results[name] = cluster_analysis
        print(f"    ✅ {cluster_analysis['cluster_count']} clusters, "
              f"{cluster_analysis['singleton_count']} singletons")
    
    # Save clustering results
    output_file = output_dir / "clustering_details.json"
    with open(output_file, "w") as f:
        json.dump({
            "collected_at": datetime.now().isoformat(),
            "runs": all_results
        }, f, indent=2)
    
    print(f"\n  ✅ Saved clustering details to {output_file}")


def collect_folder_statistics(base_url: str, repo_id: str, output_dir: Path) -> None:
    """Collect folder-level statistics."""
    print("\n📁 Collecting folder statistics...")
    
    # Get folders at different depths
    folder_stats = []
    
    for depth in [1, 2, 3]:
        folders = api_get(base_url, f"/repos/{repo_id}/folders", {"depth": depth})
        if "error" in folders:
            continue
        
        for folder in folders[:20]:  # Top 20 per depth
            # Get files in this folder
            files = api_get(base_url, f"/repos/{repo_id}/files", {
                "q": f"{folder}/",
                "limit": 500,
                "sort_by": "commits",
                "sort_dir": "desc"
            })
            
            if "error" in files or not files:
                continue
            
            total_commits = sum(f["total_commits"] for f in files)
            avg_commits = total_commits / len(files) if files else 0
            
            folder_stats.append({
                "folder": folder,
                "depth": depth,
                "file_count": len(files),
                "total_commits": total_commits,
                "avg_commits_per_file": avg_commits,
                "hottest_files": [
                    {"path": f["path"], "commits": f["total_commits"]}
                    for f in files[:5]
                ]
            })
    
    # Sort by total commits
    folder_stats.sort(key=lambda x: x["total_commits"], reverse=True)
    
    # Save folder stats
    output_file = output_dir / "folder_statistics.json"
    with open(output_file, "w") as f:
        json.dump({
            "collected_at": datetime.now().isoformat(),
            "folder_count": len(folder_stats),
            "folders": folder_stats
        }, f, indent=2)
    
    print(f"  ✅ Saved {len(folder_stats)} folder statistics to {output_file}")


def collect_coupling_matrix(base_url: str, repo_id: str, output_dir: Path) -> None:
    """Collect coupling matrix for top files."""
    print("\n🔗 Collecting coupling matrix for top files...")
    
    # Get top 30 files by commits
    files = api_get(base_url, f"/repos/{repo_id}/files", {
        "current_only": True,
        "limit": 30,
        "sort_by": "commits",
        "sort_dir": "desc"
    })
    
    if "error" in files:
        print(f"  ❌ Error: {files['error']}")
        return
    
    # Build coupling matrix
    matrix = {}
    file_paths = [f["path"] for f in files]
    
    for i, src_file in enumerate(files):
        src_path = src_file["path"]
        if i % 10 == 0:
            print(f"  Processing {i+1}/{len(files)}...")
        
        coupling = api_get(base_url, f"/repos/{repo_id}/coupling", {
            "path": src_path,
            "metric": "jaccard",
            "limit": 50,
            "min_weight": 0.0
        })
        
        if "error" in coupling or not coupling:
            matrix[src_path] = {}
            continue
        
        row = {}
        for edge in coupling:
            if edge["path"] in file_paths:
                row[edge["path"]] = {
                    "jaccard": edge["jaccard"],
                    "pair_count": edge["pair_count"]
                }
        
        matrix[src_path] = row
    
    # Save matrix
    output_file = output_dir / "coupling_matrix.json"
    with open(output_file, "w") as f:
        json.dump({
            "collected_at": datetime.now().isoformat(),
            "file_count": len(file_paths),
            "files": file_paths,
            "matrix": matrix
        }, f, indent=2)
    
    print(f"  ✅ Saved coupling matrix to {output_file}")


def main():
    parser = argparse.ArgumentParser(description="Collect detailed statistics")
    parser.add_argument("--repo", required=True, help="Repository ID")
    parser.add_argument("--base-url", default="http://localhost:8000", help="API base URL")
    parser.add_argument("--output-dir", default="QA/output", help="Output directory")
    args = parser.parse_args()
    
    repo_id = args.repo
    base_url = args.base_url
    output_dir = Path(args.output_dir) / repo_id / "detailed_stats"
    output_dir.mkdir(parents=True, exist_ok=True)
    
    print(f"\n📊 Collecting detailed statistics for: {repo_id}")
    print(f"   Base URL: {base_url}")
    print(f"   Output: {output_dir}")
    
    collect_file_details(base_url, repo_id, output_dir)
    collect_cluster_details(base_url, repo_id, output_dir)
    collect_folder_statistics(base_url, repo_id, output_dir)
    collect_coupling_matrix(base_url, repo_id, output_dir)
    
    print(f"\n✅ All detailed statistics collected!")


if __name__ == "__main__":
    main()
