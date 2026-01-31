#!/usr/bin/env python3
"""
QA Data Collection Script for LFCA (Logical File Coupling Analyzer)
Gathers comprehensive ground truth data from the OpenHands repository.
"""

import subprocess
import os
import json
import csv
from collections import defaultdict, Counter
from datetime import datetime
from pathlib import Path
import re

REPO_PATH = "/home/afettah/workspace/git-coupling-analyzer/tmp/OpenHands"
OUTPUT_DIR = "/home/afettah/workspace/git-coupling-analyzer/QA/output/openhands"


def run_git(args: list[str], cwd: str = REPO_PATH) -> str:
    """Run a git command and return stdout."""
    result = subprocess.run(
        ['git'] + args,
        capture_output=True,
        text=True,
        cwd=cwd
    )
    return result.stdout.strip()


def save_json(data: dict, filename: str):
    """Save data to JSON file."""
    filepath = os.path.join(OUTPUT_DIR, filename)
    with open(filepath, 'w') as f:
        json.dump(data, f, indent=2, default=str)
    print(f"  Saved: {filename}")


def save_csv(data: list[dict], filename: str, fieldnames: list[str]):
    """Save data to CSV file."""
    filepath = os.path.join(OUTPUT_DIR, filename)
    with open(filepath, 'w', newline='') as f:
        writer = csv.DictWriter(f, fieldnames=fieldnames)
        writer.writeheader()
        writer.writerows(data)
    print(f"  Saved: {filename}")


def gather_basic_stats():
    """Gather basic repository statistics."""
    print("\n=== Gathering Basic Statistics ===")
    
    stats = {
        "analysis_date": datetime.now().isoformat(),
        "repository": REPO_PATH,
    }
    
    # Commit counts
    stats["total_commits"] = int(run_git(['rev-list', '--count', 'HEAD']))
    stats["merge_commits"] = len([l for l in run_git(['log', '--merges', '--oneline']).split('\n') if l])
    stats["non_merge_commits"] = stats["total_commits"] - stats["merge_commits"]
    
    # Date range
    first_commit = run_git(['log', '--reverse', '--format=%H|%ci', '--max-count=1']).split('|')
    last_commit = run_git(['log', '--format=%H|%ci', '-1']).split('|')
    stats["first_commit"] = {"oid": first_commit[0], "date": first_commit[1]}
    stats["last_commit"] = {"oid": last_commit[0], "date": last_commit[1]}
    
    # File counts
    current_files = run_git(['ls-tree', '-r', 'HEAD', '--name-only']).split('\n')
    stats["current_files_count"] = len(current_files)
    
    # File types
    py_files = [f for f in current_files if f.endswith('.py')]
    ts_js_files = [f for f in current_files if any(f.endswith(ext) for ext in ['.ts', '.tsx', '.js', '.jsx'])]
    test_files = [f for f in current_files if 'test' in f.lower() or f.startswith('tests/')]
    md_files = [f for f in current_files if f.endswith('.md')]
    
    stats["file_types"] = {
        "python": len(py_files),
        "typescript_javascript": len(ts_js_files),
        "tests": len(test_files),
        "markdown": len(md_files),
    }
    
    # Authors
    authors = set(run_git(['log', '--format=%ae']).split('\n'))
    stats["unique_authors"] = len(authors)
    
    # Folder structure
    max_depth = max(f.count('/') for f in current_files) if current_files else 0
    top_folders = set(f.split('/')[0] for f in current_files if '/' in f)
    stats["max_folder_depth"] = max_depth
    stats["top_level_folders"] = len(top_folders)
    
    save_json(stats, "basic_stats.json")
    return stats


def gather_file_commit_counts():
    """Get commit counts for each file."""
    print("\n=== Gathering File Commit Counts ===")
    
    # Get all file paths and their commit counts
    log_output = run_git(['log', '--name-only', '--pretty=format:'])
    file_counts = Counter(line for line in log_output.split('\n') if line)
    
    # Sort by count
    sorted_files = sorted(file_counts.items(), key=lambda x: -x[1])
    
    # Save as CSV
    data = [{"path": path, "commit_count": count} for path, count in sorted_files]
    save_csv(data, "file_commits.csv", ["path", "commit_count"])
    
    # Save top 100 as JSON
    top_100 = [{"path": path, "commit_count": count} for path, count in sorted_files[:100]]
    result = {
        "analysis_date": datetime.now().isoformat(),
        "total_unique_files": len(file_counts),
        "top_100_hotspots": top_100
    }
    save_json(result, "file_commits.json")
    
    return file_counts


def gather_cochange_pairs(min_cooccurrence: int = 3):
    """Find file pairs that frequently change together."""
    print(f"\n=== Gathering Co-change Pairs (min={min_cooccurrence}) ===")
    
    # Get commits with their files
    log_output = run_git(['log', '--name-only', '--pretty=format:COMMIT'])
    
    commits = []
    current_files = []
    
    for line in log_output.split('\n'):
        if line == 'COMMIT':
            if len(current_files) > 1 and len(current_files) <= 100:  # Skip bulk commits
                commits.append(current_files)
            current_files = []
        elif line:
            current_files.append(line)
    
    # Count pairs
    pair_counts = defaultdict(int)
    for files in commits:
        files = sorted(set(files))
        for i, f1 in enumerate(files):
            for f2 in files[i+1:]:
                pair_counts[(f1, f2)] += 1
    
    # Filter by minimum co-occurrence
    filtered_pairs = [(f1, f2, count) for (f1, f2), count in pair_counts.items() if count >= min_cooccurrence]
    filtered_pairs.sort(key=lambda x: -x[2])
    
    # Save as CSV
    data = [{"file_a": f1, "file_b": f2, "cochange_count": count} for f1, f2, count in filtered_pairs]
    save_csv(data, "cochange_pairs.csv", ["file_a", "file_b", "cochange_count"])
    
    # Save top 500 as JSON
    result = {
        "analysis_date": datetime.now().isoformat(),
        "min_cooccurrence": min_cooccurrence,
        "total_pairs": len(filtered_pairs),
        "top_500_pairs": [
            {"file_a": f1, "file_b": f2, "cochange_count": count}
            for f1, f2, count in filtered_pairs[:500]
        ]
    }
    save_json(result, "cochange_pairs.json")
    
    return filtered_pairs


def gather_renames():
    """Detect file renames in history."""
    print("\n=== Detecting File Renames ===")
    
    # Get renames
    log_output = run_git(['log', '--name-status', '--diff-filter=R', '-M90', '--pretty=format:COMMIT:%H'])
    
    renames = []
    current_commit = None
    
    for line in log_output.split('\n'):
        if line.startswith('COMMIT:'):
            current_commit = line[7:]
        elif line.startswith('R'):
            parts = line.split('\t')
            if len(parts) >= 3:
                similarity = parts[0][1:] if len(parts[0]) > 1 else "100"
                renames.append({
                    "commit_oid": current_commit,
                    "old_path": parts[1],
                    "new_path": parts[2],
                    "similarity": int(similarity) if similarity else 100
                })
    
    # Save as CSV
    save_csv(renames, "renames.csv", ["commit_oid", "old_path", "new_path", "similarity"])
    
    # Build rename chains
    rename_chains = {}
    for r in renames:
        old, new = r["old_path"], r["new_path"]
        # Find if old path is in an existing chain
        found = False
        for chain_id, chain in rename_chains.items():
            if chain[-1] == old:
                chain.append(new)
                found = True
                break
        if not found:
            rename_chains[old] = [old, new]
    
    result = {
        "analysis_date": datetime.now().isoformat(),
        "total_renames": len(renames),
        "renames": renames[:200],  # First 200
        "rename_chains": [{"chain": chain, "length": len(chain)} 
                          for chain in rename_chains.values() if len(chain) > 2]
    }
    save_json(result, "renames.json")
    
    return renames


def gather_bulk_commits(threshold: int = 50):
    """Find commits with many files (potential refactors)."""
    print(f"\n=== Finding Bulk Commits (>{threshold} files) ===")
    
    # Get commit file counts
    log_output = run_git(['log', '--pretty=format:COMMIT|%H|%ae|%ci|%s', '--name-only'])
    
    commits = []
    current = None
    file_count = 0
    
    for line in log_output.split('\n'):
        if line.startswith('COMMIT|'):
            if current and file_count >= threshold:
                current["file_count"] = file_count
                commits.append(current)
            parts = line.split('|')
            current = {
                "commit_oid": parts[1],
                "author": parts[2],
                "date": parts[3],
                "subject": parts[4][:200] if len(parts) > 4 else ""
            }
            file_count = 0
        elif line and current:
            file_count += 1
    
    # Don't forget the last one
    if current and file_count >= threshold:
        current["file_count"] = file_count
        commits.append(current)
    
    commits.sort(key=lambda x: -x["file_count"])
    
    # Save as CSV
    save_csv(commits, "bulk_commits.csv", ["commit_oid", "file_count", "author", "date", "subject"])
    
    # Commit size distribution
    all_commits_log = run_git(['log', '--pretty=format:COMMIT', '--name-only'])
    size_counts = Counter()
    current_count = 0
    
    for line in all_commits_log.split('\n'):
        if line == 'COMMIT':
            if current_count > 0:
                bucket = (
                    "1" if current_count == 1 else
                    "2-5" if current_count <= 5 else
                    "6-10" if current_count <= 10 else
                    "11-20" if current_count <= 20 else
                    "21-50" if current_count <= 50 else
                    "51-100" if current_count <= 100 else
                    "100+"
                )
                size_counts[bucket] += 1
            current_count = 0
        elif line:
            current_count += 1
    
    result = {
        "analysis_date": datetime.now().isoformat(),
        "threshold": threshold,
        "bulk_commits_count": len(commits),
        "bulk_commits": commits[:50],
        "commit_size_distribution": dict(size_counts)
    }
    save_json(result, "bulk_commits.json")
    
    return commits


def gather_deleted_files():
    """Find files that were deleted from the repository."""
    print("\n=== Finding Deleted Files ===")
    
    # Get all historical files
    all_files_output = run_git(['log', '--all', '--name-only', '--pretty=format:'])
    all_historical = set(line for line in all_files_output.split('\n') if line)
    
    # Get current files
    current_files = set(run_git(['ls-tree', '-r', 'HEAD', '--name-only']).split('\n'))
    
    # Deleted = in history but not at HEAD
    deleted = all_historical - current_files
    
    # Get details for deleted files
    deleted_details = []
    for filepath in list(deleted)[:500]:  # Limit to first 500
        commit_count = len(run_git(['log', '--oneline', '--', filepath]).split('\n'))
        last_commit = run_git(['log', '-1', '--pretty=format:%H|%ci', '--', filepath])
        if last_commit:
            parts = last_commit.split('|')
            deleted_details.append({
                "path": filepath,
                "commit_count": commit_count,
                "last_commit": parts[0] if parts else "",
                "last_commit_date": parts[1] if len(parts) > 1 else ""
            })
    
    deleted_details.sort(key=lambda x: -x["commit_count"])
    
    # Save as CSV
    save_csv(deleted_details, "deleted_files.csv", 
             ["path", "commit_count", "last_commit", "last_commit_date"])
    
    result = {
        "analysis_date": datetime.now().isoformat(),
        "total_historical_files": len(all_historical),
        "current_files": len(current_files),
        "deleted_files_count": len(deleted),
        "deleted_files_sample": deleted_details[:100]
    }
    save_json(result, "deleted_files.json")
    
    return deleted


def gather_author_stats():
    """Analyze author contributions."""
    print("\n=== Analyzing Author Contributions ===")
    
    # Get commits per author
    log_output = run_git(['log', '--format=%ae|%ci'])
    
    author_commits = Counter()
    author_dates = defaultdict(list)
    
    for line in log_output.split('\n'):
        if '|' in line:
            author, date = line.rsplit('|', 1)
            author_commits[author] += 1
            author_dates[author].append(date[:10])  # Just the date part
    
    # Build author stats
    author_stats = []
    for author, count in author_commits.most_common():
        dates = sorted(author_dates[author])
        author_stats.append({
            "author_email": author,
            "commit_count": count,
            "first_commit": dates[0],
            "last_commit": dates[-1],
            "active_days": len(set(dates))
        })
    
    # Save as CSV
    save_csv(author_stats, "author_stats.csv", 
             ["author_email", "commit_count", "first_commit", "last_commit", "active_days"])
    
    # Bus factor calculation (authors covering 50% of commits)
    total_commits = sum(author_commits.values())
    half_commits = total_commits // 2
    running_sum = 0
    bus_factor = 0
    for author, count in author_commits.most_common():
        running_sum += count
        bus_factor += 1
        if running_sum >= half_commits:
            break
    
    # Commit distribution by day of week
    dow_output = run_git(['log', '--format=%ad', '--date=format:%A'])
    dow_counts = Counter(dow_output.split('\n'))
    
    # Commit distribution by hour
    hour_output = run_git(['log', '--format=%ad', '--date=format:%H'])
    hour_counts = Counter(hour_output.split('\n'))
    
    result = {
        "analysis_date": datetime.now().isoformat(),
        "total_authors": len(author_commits),
        "total_commits": total_commits,
        "bus_factor": bus_factor,
        "top_20_contributors": author_stats[:20],
        "contribution_stats": {
            "top_1_share_pct": round(author_stats[0]["commit_count"] / total_commits * 100, 2) if author_stats else 0,
            "top_5_share_pct": round(sum(a["commit_count"] for a in author_stats[:5]) / total_commits * 100, 2),
            "top_10_share_pct": round(sum(a["commit_count"] for a in author_stats[:10]) / total_commits * 100, 2),
        },
        "commits_by_day_of_week": dict(dow_counts),
        "commits_by_hour": dict(hour_counts),
    }
    save_json(result, "author_analysis.json")
    
    return author_stats


def gather_module_analysis():
    """Analyze module/folder structure."""
    print("\n=== Analyzing Module Structure ===")
    
    # Get files grouped by top-level folder
    current_files = run_git(['ls-tree', '-r', 'HEAD', '--name-only']).split('\n')
    
    folder_files = defaultdict(list)
    for f in current_files:
        parts = f.split('/')
        top_folder = parts[0] if len(parts) > 1 else '.'
        folder_files[top_folder].append(f)
    
    # Get commit counts per folder
    folder_stats = []
    for folder, files in sorted(folder_files.items()):
        commit_count = len([l for l in run_git(['log', '--oneline', '--', folder + '/']).split('\n') if l])
        folder_stats.append({
            "folder": folder,
            "file_count": len(files),
            "commit_count": commit_count
        })
    
    folder_stats.sort(key=lambda x: -x["commit_count"])
    
    # Save as CSV
    save_csv(folder_stats, "folder_stats.csv", ["folder", "file_count", "commit_count"])
    
    # Analyze cross-module commits
    log_output = run_git(['log', '--name-only', '--pretty=format:COMMIT|%H'])
    
    cross_module = []
    current_commit = None
    folders_in_commit = set()
    
    for line in log_output.split('\n'):
        if line.startswith('COMMIT|'):
            if current_commit and len(folders_in_commit) > 1:
                cross_module.append({
                    "commit_oid": current_commit,
                    "folder_count": len(folders_in_commit),
                    "folders": list(folders_in_commit)
                })
            current_commit = line.split('|')[1]
            folders_in_commit = set()
        elif line and '/' in line:
            folders_in_commit.add(line.split('/')[0])
    
    cross_module.sort(key=lambda x: -x["folder_count"])
    
    result = {
        "analysis_date": datetime.now().isoformat(),
        "folder_count": len(folder_stats),
        "folder_stats": folder_stats,
        "cross_module_commits_count": len(cross_module),
        "cross_module_commits_sample": cross_module[:50]
    }
    save_json(result, "module_analysis.json")
    
    return folder_stats


def gather_test_impl_coupling():
    """Analyze test file to implementation file coupling."""
    print("\n=== Analyzing Test-Implementation Coupling ===")
    
    current_files = run_git(['ls-tree', '-r', 'HEAD', '--name-only']).split('\n')
    
    # Find test files
    test_files = [f for f in current_files if re.match(r'.*(test_.*\.py|_test\.py|\.test\.(ts|js|tsx|jsx))$', f)]
    
    pairs = []
    
    for test_file in test_files[:100]:  # Limit to first 100
        # Try to find corresponding implementation
        basename = os.path.basename(test_file)
        
        impl_name = None
        if basename.startswith('test_') and basename.endswith('.py'):
            impl_name = basename[5:]  # Remove 'test_' prefix
        elif basename.endswith('_test.py'):
            impl_name = basename[:-8] + '.py'  # Remove '_test' suffix
        elif '.test.' in basename:
            impl_name = basename.replace('.test.', '.')
        
        if impl_name:
            # Find matching implementation
            impl_file = None
            for f in current_files:
                if f.endswith(impl_name) and f != test_file:
                    impl_file = f
                    break
            
            if impl_file:
                # Get commit OIDs for each file
                test_oids = set(run_git(['log', '--pretty=format:%H', '--', test_file]).split('\n'))
                impl_oids = set(run_git(['log', '--pretty=format:%H', '--', impl_file]).split('\n'))
                
                test_commits = len(test_oids)
                impl_commits = len(impl_oids)
                cochange = len(test_oids & impl_oids)
                
                if test_commits > 0 and impl_commits > 0:
                    union = test_commits + impl_commits - cochange
                    jaccard = cochange / union if union > 0 else 0
                    
                    pairs.append({
                        "test_file": test_file,
                        "impl_file": impl_file,
                        "test_commits": test_commits,
                        "impl_commits": impl_commits,
                        "cochange_count": cochange,
                        "jaccard": round(jaccard, 4)
                    })
    
    pairs.sort(key=lambda x: -x["jaccard"])
    
    # Save as CSV
    save_csv(pairs, "test_impl_pairs.csv", 
             ["test_file", "impl_file", "test_commits", "impl_commits", "cochange_count", "jaccard"])
    
    result = {
        "analysis_date": datetime.now().isoformat(),
        "total_test_files": len(test_files),
        "matched_pairs": len(pairs),
        "high_coupling_pairs": len([p for p in pairs if p["jaccard"] > 0.3]),
        "pairs": pairs[:50],
        "average_jaccard": round(sum(p["jaccard"] for p in pairs) / len(pairs), 4) if pairs else 0
    }
    save_json(result, "test_impl_coupling.json")
    
    return pairs


def gather_coupling_ground_truth():
    """Generate detailed coupling ground truth for validation."""
    print("\n=== Generating Coupling Ground Truth ===")
    
    # Get all file commit OIDs
    current_files = run_git(['ls-tree', '-r', 'HEAD', '--name-only']).split('\n')
    
    file_commits = {}
    for f in current_files[:500]:  # Limit for performance
        oids = set(run_git(['log', '--pretty=format:%H', '--', f]).split('\n'))
        file_commits[f] = oids
    
    # Calculate coupling for pairs with significant co-change
    pairs_data = []
    files = list(file_commits.keys())
    
    for i, f1 in enumerate(files):
        if i % 50 == 0:
            print(f"  Processing file {i}/{len(files)}")
        for f2 in files[i+1:]:
            cochange = len(file_commits[f1] & file_commits[f2])
            if cochange >= 3:  # Minimum threshold
                c1 = len(file_commits[f1])
                c2 = len(file_commits[f2])
                union = c1 + c2 - cochange
                jaccard = cochange / union if union > 0 else 0
                
                if jaccard > 0.05:  # Only significant coupling
                    pairs_data.append({
                        "file_a": f1,
                        "file_b": f2,
                        "commits_a": c1,
                        "commits_b": c2,
                        "cochange_count": cochange,
                        "jaccard": round(jaccard, 4),
                        "prob_b_given_a": round(cochange / c1, 4) if c1 > 0 else 0,
                        "prob_a_given_b": round(cochange / c2, 4) if c2 > 0 else 0
                    })
    
    pairs_data.sort(key=lambda x: -x["jaccard"])
    
    # Save as CSV
    save_csv(pairs_data, "coupling_ground_truth.csv",
             ["file_a", "file_b", "commits_a", "commits_b", "cochange_count", 
              "jaccard", "prob_b_given_a", "prob_a_given_b"])
    
    # Distribution analysis
    jaccard_buckets = Counter()
    for p in pairs_data:
        j = p["jaccard"]
        bucket = (
            "0.0-0.1" if j < 0.1 else
            "0.1-0.2" if j < 0.2 else
            "0.2-0.3" if j < 0.3 else
            "0.3-0.4" if j < 0.4 else
            "0.4-0.5" if j < 0.5 else
            "0.5+"
        )
        jaccard_buckets[bucket] += 1
    
    result = {
        "analysis_date": datetime.now().isoformat(),
        "total_pairs_analyzed": len(pairs_data),
        "high_coupling_pairs": len([p for p in pairs_data if p["jaccard"] > 0.3]),
        "very_high_coupling_pairs": len([p for p in pairs_data if p["jaccard"] > 0.5]),
        "top_50_coupled_pairs": pairs_data[:50],
        "coupling_distribution": dict(jaccard_buckets)
    }
    save_json(result, "coupling_ground_truth.json")
    
    return pairs_data


def gather_hotspot_analysis():
    """Analyze code hotspots and churn."""
    print("\n=== Analyzing Code Hotspots ===")
    
    # Get file churn data
    log_output = run_git(['log', '--numstat', '--pretty=format:COMMIT'])
    
    file_stats = defaultdict(lambda: {"commits": 0, "insertions": 0, "deletions": 0})
    
    for line in log_output.split('\n'):
        if line == 'COMMIT':
            continue
        parts = line.split('\t')
        if len(parts) == 3:
            insertions, deletions, filepath = parts
            try:
                ins = int(insertions) if insertions != '-' else 0
                dels = int(deletions) if deletions != '-' else 0
                file_stats[filepath]["commits"] += 1
                file_stats[filepath]["insertions"] += ins
                file_stats[filepath]["deletions"] += dels
            except ValueError:
                pass
    
    # Calculate churn
    churn_data = []
    current_files = set(run_git(['ls-tree', '-r', 'HEAD', '--name-only']).split('\n'))
    
    for filepath, stats in file_stats.items():
        churn = stats["insertions"] + stats["deletions"]
        churn_data.append({
            "path": filepath,
            "commits": stats["commits"],
            "insertions": stats["insertions"],
            "deletions": stats["deletions"],
            "churn": churn,
            "exists_at_head": filepath in current_files
        })
    
    churn_data.sort(key=lambda x: -x["churn"])
    
    # Save as CSV
    save_csv(churn_data, "file_churn.csv",
             ["path", "commits", "insertions", "deletions", "churn", "exists_at_head"])
    
    result = {
        "analysis_date": datetime.now().isoformat(),
        "total_files_with_changes": len(churn_data),
        "total_churn": sum(f["churn"] for f in churn_data),
        "top_20_by_churn": churn_data[:20],
        "top_20_by_commits": sorted(churn_data, key=lambda x: -x["commits"])[:20]
    }
    save_json(result, "hotspot_analysis.json")
    
    return churn_data


def create_summary_report():
    """Create a summary of all gathered data."""
    print("\n=== Creating Summary Report ===")
    
    # Load all JSON files
    json_files = [
        "basic_stats.json",
        "file_commits.json",
        "cochange_pairs.json",
        "renames.json",
        "bulk_commits.json",
        "deleted_files.json",
        "author_analysis.json",
        "module_analysis.json",
        "test_impl_coupling.json",
        "coupling_ground_truth.json",
        "hotspot_analysis.json"
    ]
    
    summary = {
        "analysis_date": datetime.now().isoformat(),
        "repository": REPO_PATH,
        "output_directory": OUTPUT_DIR,
        "generated_files": []
    }
    
    for jf in json_files:
        filepath = os.path.join(OUTPUT_DIR, jf)
        if os.path.exists(filepath):
            with open(filepath) as f:
                data = json.load(f)
            summary["generated_files"].append({
                "filename": jf,
                "exists": True
            })
    
    # List all generated files
    all_files = sorted(os.listdir(OUTPUT_DIR))
    summary["all_output_files"] = all_files
    
    save_json(summary, "qa_summary.json")
    return summary


def main():
    """Run all QA data collection."""
    print("=" * 60)
    print("  LFCA QA - Ground Truth Data Collection")
    print("=" * 60)
    print(f"\nRepository: {REPO_PATH}")
    print(f"Output: {OUTPUT_DIR}")
    
    os.makedirs(OUTPUT_DIR, exist_ok=True)
    
    start_time = datetime.now()
    
    # Run all gatherers
    gather_basic_stats()
    gather_file_commit_counts()
    gather_cochange_pairs()
    gather_renames()
    gather_bulk_commits()
    gather_deleted_files()
    gather_author_stats()
    gather_module_analysis()
    gather_test_impl_coupling()
    gather_hotspot_analysis()
    gather_coupling_ground_truth()
    
    # Create summary
    create_summary_report()
    
    end_time = datetime.now()
    duration = (end_time - start_time).total_seconds()
    
    print("\n" + "=" * 60)
    print("  QA Data Collection Complete!")
    print("=" * 60)
    print(f"\nDuration: {duration:.1f} seconds")
    print(f"Output directory: {OUTPUT_DIR}")
    print("\nGenerated files:")
    for f in sorted(os.listdir(OUTPUT_DIR)):
        size = os.path.getsize(os.path.join(OUTPUT_DIR, f))
        print(f"  {f} ({size:,} bytes)")


if __name__ == "__main__":
    main()
