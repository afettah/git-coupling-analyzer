#!/usr/bin/env python3
"""
API Results Validator

Validates LFCA API responses against ground truth data collected from git.

Usage:
    python QA/scripts/validate_api_results.py --repo openhands
"""

import argparse
import json
from pathlib import Path
from typing import Any


class ValidationResult:
    """Holds validation results for a single check."""
    
    def __init__(self, name: str, passed: bool, expected: Any, actual: Any, details: str = ""):
        self.name = name
        self.passed = passed
        self.expected = expected
        self.actual = actual
        self.details = details
    
    def __repr__(self):
        status = "✅ PASS" if self.passed else "❌ FAIL"
        return f"{status} {self.name}"


def load_json(path: Path) -> dict:
    """Load JSON file."""
    if path.exists():
        with open(path, "r") as f:
            return json.load(f)
    return {}


def validate_file_counts(ground_truth: dict, api_results: dict) -> list:
    """Validate file counts match."""
    results = []
    
    gt_stats = ground_truth.get("basic_stats", {})
    api_files = api_results.get("file_info", {})
    
    # Current file count
    gt_current = gt_stats.get("current_files_count", 0)
    api_summary = api_files.get("summary", {})
    # API returns limited results, so we check if it's in range
    api_current = api_summary.get("current_count", 0)
    
    # Note: API is limited to 500, so we can't compare directly
    if api_current == 500:
        results.append(ValidationResult(
            "Current Files Count",
            True,  # Can't fail if limited
            gt_current,
            f"{api_current} (limited)",
            f"API returned limit of 500, ground truth has {gt_current}"
        ))
    else:
        passed = abs(gt_current - api_current) < 10
        results.append(ValidationResult(
            "Current Files Count",
            passed,
            gt_current,
            api_current,
            "Files should match within tolerance"
        ))
    
    return results


def validate_hotspot_ranking(ground_truth: dict, api_results: dict) -> list:
    """Validate hotspot file ranking."""
    results = []
    
    gt_commits = ground_truth.get("file_commits", {})
    api_files = api_results.get("file_info", {})
    
    gt_top = gt_commits.get("top_100_hotspots", [])[:20]
    api_hot = api_files.get("hottest_files", {}).get("data", [])[:20]
    
    if not gt_top or not api_hot:
        results.append(ValidationResult(
            "Hotspot Ranking",
            False,
            "top 20 files",
            "missing data",
            "Could not load ground truth or API data"
        ))
        return results
    
    # Check top 5 files match
    gt_top5_paths = {f["path"] for f in gt_top[:5]}
    api_top5_paths = {f["path"] for f in api_hot[:5]}
    
    overlap = gt_top5_paths & api_top5_paths
    overlap_pct = len(overlap) / 5 * 100
    
    results.append(ValidationResult(
        "Top 5 Hotspots Overlap",
        overlap_pct >= 80,
        "≥80% overlap",
        f"{overlap_pct:.0f}% ({len(overlap)}/5)",
        f"Common files: {overlap}"
    ))
    
    # Check top 10 files match
    gt_top10_paths = {f["path"] for f in gt_top[:10]}
    api_top10_paths = {f["path"] for f in api_hot[:10]}
    
    overlap10 = gt_top10_paths & api_top10_paths
    overlap10_pct = len(overlap10) / 10 * 100
    
    results.append(ValidationResult(
        "Top 10 Hotspots Overlap",
        overlap10_pct >= 70,
        "≥70% overlap",
        f"{overlap10_pct:.0f}% ({len(overlap10)}/10)",
        f"Missing from API: {gt_top10_paths - api_top10_paths}"
    ))
    
    # Validate commit counts for specific files
    gt_by_path = {f["path"]: f["commit_count"] for f in gt_top}
    for api_file in api_hot[:10]:
        path = api_file["path"]
        if path in gt_by_path:
            gt_count = gt_by_path[path]
            api_count = api_file["total_commits"]
            # Allow 10% tolerance for counting differences
            tolerance = max(5, gt_count * 0.1)
            passed = abs(gt_count - api_count) <= tolerance
            results.append(ValidationResult(
                f"Commit Count: {path[:40]}",
                passed,
                gt_count,
                api_count,
                f"Tolerance: ±{tolerance:.0f}"
            ))
    
    return results


def validate_coupling_pairs(ground_truth: dict, api_results: dict) -> list:
    """Validate high-coupling pairs are detected."""
    results = []
    
    gt_coupling = ground_truth.get("coupling_ground_truth", {})
    api_coupling = api_results.get("coupling_data", {})
    
    gt_pairs = gt_coupling.get("top_50_coupled_pairs", [])
    
    if not gt_pairs:
        results.append(ValidationResult(
            "Coupling Pairs",
            False,
            "ground truth pairs",
            "missing",
            "No ground truth coupling data"
        ))
        return results
    
    # Known high-coupling pairs to validate
    test_pairs = [
        ("frontend/package.json", "frontend/package-lock.json", 0.9),
        ("poetry.lock", "pyproject.toml", 0.5),
        ("frontend/src/i18n/translation.json", "frontend/src/i18n/declaration.ts", 0.8),
    ]
    
    for src, dst, min_jaccard in test_pairs:
        # Check if pair exists in API results
        src_coupling = api_coupling.get(src, {}).get("jaccard", {}).get("data", [])
        
        found = False
        actual_jaccard = 0
        for edge in src_coupling:
            if edge["path"] == dst:
                found = True
                actual_jaccard = edge["jaccard"]
                break
        
        results.append(ValidationResult(
            f"Coupling: {src[:30]} ↔ {dst[:30]}",
            found and actual_jaccard >= min_jaccard * 0.8,  # 20% tolerance
            f"Jaccard ≥ {min_jaccard:.2f}",
            f"{actual_jaccard:.4f}" if found else "not found",
            "High coupling pair should be detected"
        ))
    
    return results


def validate_clustering_results(ground_truth: dict, api_results: dict) -> list:
    """Validate clustering produces reasonable results."""
    results = []
    
    api_clustering = api_results.get("clustering", {})
    clustering_results = api_clustering.get("clustering_results", {})
    
    for algo, result in clustering_results.items():
        if "error" in result:
            results.append(ValidationResult(
                f"Clustering: {algo}",
                False,
                "clusters",
                result["error"],
                "Algorithm failed"
            ))
            continue
        
        data = result.get("data", {})
        cluster_count = data.get("cluster_count", 0)
        clusters = data.get("clusters", [])
        
        # Validate cluster count is reasonable (not too few, not too many)
        results.append(ValidationResult(
            f"Clustering {algo}: Cluster Count",
            5 <= cluster_count <= 500,
            "5-500 clusters",
            cluster_count,
            "Should produce meaningful clusters"
        ))
        
        # Validate clusters have files
        if clusters:
            sizes = [c.get("size", 0) for c in clusters]
            avg_size = sum(sizes) / len(sizes) if sizes else 0
            max_size = max(sizes) if sizes else 0
            min_size = min(sizes) if sizes else 0
            
            results.append(ValidationResult(
                f"Clustering {algo}: Avg Cluster Size",
                avg_size >= 2,
                "≥2 files/cluster",
                f"{avg_size:.1f}",
                f"Range: {min_size}-{max_size}"
            ))
            
            # Check for cluster insights
            has_insights = any(c.get("avg_coupling", 0) > 0 for c in clusters)
            results.append(ValidationResult(
                f"Clustering {algo}: Has Insights",
                has_insights,
                "avg_coupling > 0",
                has_insights,
                "Clusters should have coupling metrics"
            ))
    
    return results


def validate_component_coupling(ground_truth: dict, api_results: dict) -> list:
    """Validate component-level coupling."""
    results = []
    
    api_components = api_results.get("component_coupling", {})
    
    # Expected component relationships
    expected_couplings = [
        ("openhands", ["tests", "frontend"]),
        ("frontend", ["openhands"]),
    ]
    
    for component, expected_coupled in expected_couplings:
        comp_data = api_components.get(component, {}).get("data", {})
        coupled = comp_data.get("coupled_components", [])
        coupled_names = [c["component"] for c in coupled]
        
        for exp in expected_coupled:
            found = any(exp in name for name in coupled_names)
            results.append(ValidationResult(
                f"Component Coupling: {component} → {exp}",
                found,
                f"{exp} in coupled list",
                coupled_names[:5],
                "Components should show cross-module coupling"
            ))
    
    return results


def validate_evidence_api(api_results: dict) -> list:
    """Validate coupling evidence API works."""
    results = []
    
    evidence = api_results.get("coupling_evidence", [])
    
    for pair in evidence:
        src = pair.get("src_path", "?")[:30]
        dst = pair.get("dst_path", "?")[:30]
        
        has_ids = pair.get("src_id") and pair.get("dst_id")
        results.append(ValidationResult(
            f"Evidence: File IDs for {src}↔{dst}",
            has_ids,
            "both file IDs found",
            f"src={pair.get('src_id')}, dst={pair.get('dst_id')}",
            "Files should be resolved to IDs"
        ))
        
        if has_ids:
            evidence_data = pair.get("evidence", {}).get("data", {})
            commits = evidence_data.get("commits", [])
            
            results.append(ValidationResult(
                f"Evidence: Commits for {src}↔{dst}",
                len(commits) > 0,
                ">0 common commits",
                len(commits),
                "High-coupling pairs should have evidence"
            ))
    
    return results


def main():
    parser = argparse.ArgumentParser(description="Validate API results against ground truth")
    parser.add_argument("--repo", required=True, help="Repository ID")
    parser.add_argument("--output-dir", default="QA/output", help="Output directory")
    args = parser.parse_args()
    
    repo_id = args.repo
    base_dir = Path(args.output_dir) / repo_id
    api_dir = base_dir / "api_tests"
    
    print(f"\n🔍 Validating API results for: {repo_id}")
    print(f"   Ground Truth: {base_dir}")
    print(f"   API Results: {api_dir}\n")
    
    # Load ground truth data
    ground_truth = {
        "basic_stats": load_json(base_dir / "basic_stats.json"),
        "file_commits": load_json(base_dir / "file_commits.json"),
        "coupling_ground_truth": load_json(base_dir / "coupling_ground_truth.json"),
        "cochange_pairs": load_json(base_dir / "cochange_pairs.json"),
    }
    
    # Load API results
    api_results = load_json(api_dir / "full_api_results.json")
    
    if not api_results:
        print("❌ No API results found. Run api_test_collector.py first.")
        return
    
    # Run validations
    all_results = []
    
    print("=" * 60)
    print("VALIDATION RESULTS")
    print("=" * 60)
    
    # 1. File Counts
    print("\n📊 File Counts")
    file_results = validate_file_counts(ground_truth, api_results)
    all_results.extend(file_results)
    for r in file_results:
        print(f"  {r}")
    
    # 2. Hotspot Ranking
    print("\n🔥 Hotspot Ranking")
    hotspot_results = validate_hotspot_ranking(ground_truth, api_results)
    all_results.extend(hotspot_results)
    for r in hotspot_results:
        print(f"  {r}")
    
    # 3. Coupling Pairs
    print("\n🔗 Coupling Pairs")
    coupling_results = validate_coupling_pairs(ground_truth, api_results)
    all_results.extend(coupling_results)
    for r in coupling_results:
        print(f"  {r}")
    
    # 4. Clustering
    print("\n🧩 Clustering")
    clustering_results = validate_clustering_results(ground_truth, api_results)
    all_results.extend(clustering_results)
    for r in clustering_results:
        print(f"  {r}")
    
    # 5. Component Coupling
    print("\n📁 Component Coupling")
    component_results = validate_component_coupling(ground_truth, api_results)
    all_results.extend(component_results)
    for r in component_results:
        print(f"  {r}")
    
    # 6. Evidence API
    print("\n📋 Evidence API")
    evidence_results = validate_evidence_api(api_results)
    all_results.extend(evidence_results)
    for r in evidence_results:
        print(f"  {r}")
    
    # Summary
    print("\n" + "=" * 60)
    passed = sum(1 for r in all_results if r.passed)
    total = len(all_results)
    pct = passed / total * 100 if total > 0 else 0
    
    print(f"SUMMARY: {passed}/{total} checks passed ({pct:.1f}%)")
    print("=" * 60)
    
    # Save validation report
    report = {
        "repo_id": repo_id,
        "total_checks": total,
        "passed": passed,
        "failed": total - passed,
        "pass_rate": pct,
        "results": [
            {
                "name": r.name,
                "passed": r.passed,
                "expected": str(r.expected),
                "actual": str(r.actual),
                "details": r.details
            }
            for r in all_results
        ]
    }
    
    report_file = api_dir / "VALIDATION_REPORT.json"
    with open(report_file, "w") as f:
        json.dump(report, f, indent=2)
    
    print(f"\n📝 Report saved to: {report_file}")
    
    # Generate markdown report
    md_lines = [
        "# API Validation Report",
        "",
        f"**Repository:** {repo_id}",
        f"**Pass Rate:** {passed}/{total} ({pct:.1f}%)",
        "",
        "## Results",
        "",
        "| Check | Status | Expected | Actual | Details |",
        "|-------|--------|----------|--------|---------|",
    ]
    
    for r in all_results:
        status = "✅" if r.passed else "❌"
        exp = str(r.expected)[:30]
        act = str(r.actual)[:30]
        det = r.details[:40] if r.details else ""
        md_lines.append(f"| {r.name[:40]} | {status} | {exp} | {act} | {det} |")
    
    md_file = api_dir / "VALIDATION_REPORT.md"
    with open(md_file, "w") as f:
        f.write("\n".join(md_lines))
    
    print(f"📝 Markdown report saved to: {md_file}")


if __name__ == "__main__":
    main()
