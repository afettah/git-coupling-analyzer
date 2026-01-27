# Improvement Suggestions for LFCA

This document outlines proposed enhancements for the Logical File Coupling Analyzer to improve usability, analysis quality, and system performance.

---

## Save Clustering Results

add optiona to save clustering results to a file

allow reopon clustering snapshots

allow export of clustering results : export a cluster (from the cluster car directly) , export all clusters, support csv 

## Impact Graph 
Impact Graph is allways empty. is implemented ? what it do ? 
improve the ui with predefined values ; view and help user to uses it with hints, examples and contorl of accepted values

## Folder Tree 
Folder tree sould allow to open file / folder history , coupled files with paramters of how to compute 

## Folder Tree 
Should add filters and predefined filters like stable files, high changed files, recently changed ...
with all possible filters we can add in adapted way to see most important filters and adavanced filters 

## Cluster 

cluster should have more options to see details of the cluster , commits, and other idea can be helpfull here 

## Grafic view

uses adapted librireis to dispaly interactif graph with more options to navigate and explore the graph for clusters for files ...., should support click to open ...


## 1. Better Usage (UX & Developer Experience)

### 1.1 "Explain" Feature
**Problem:** Users see a high coupling score (e.g., 85%) but don't know *why*.
**Suggestion:**
- Add an "Explain Coupling" API/UI feature.
- When clicking an edge, show the specific **Transactions (Commits)** that contributed most to the weight.
- Highlight commit messages (e.g., "Feature: Auth Refactor") to give context.


### 1.4 Smart Filtering
**Problem:** Noise from auto-generated files, assets, or tests can clutter the view.
**Suggestion:**
- Support `.lfcaignore` (extends `.gitignore`) to exclude specific paths from analysis.
- UI toggles to "Hide Tests", "Hide Assets", or "Hide Vendor" folders instantly without re-running analysis.

---

## 2. Better Results (Analysis Quality)



### 2.4 Trend Detection (Hotspots)
**Problem:** A file might have high historical coupling that is no longer relevant.
**Suggestion:**
- Calculate **"Velocity of Coupling"**: Is the coupling between A and B increasing or decreasing in the last 3 months?
- Visualize "Rising Stars" (newly coupled pairs) vs. "Legacy Coupling" (old, decaying connections).

---

## 3. Better Performance (Speed & Scalability)

### 3.1 Adopt Polars over Pandas
**Problem:** Pandas can be memory-intensive and slow for large datasets.
**Suggestion:**
- Migrate data processing (Edge Building, Extract) to **Polars**.
- Polars offers lazy evaluation, true multi-threading, and significant memory efficiency for large Parquet operations.

### 3.2 DuckDB for Querying
**Problem:** Loading Parquet into memory for every API request limits scalability.
**Suggestion:**
- Use **DuckDB** to query Parquet files directly from disk without full loading.
- Enable fast SQL-over-Parquet for filtering, aggregation, and Top-K queries.

### 3.3 Incremental Extraction
**Problem:** Re-analyzing the entire history for every new commit is wasteful.
**Suggestion:**
- Store the `last_processed_commit_sha`.
- On new runs, `git log` only from `last_processed_commit_sha..HEAD`.
- Append new transactions to partitioned Parquet datasets (e.g., `transactions/year=2024/month=02`).

### 3.4 Parallel Graph Algorithms
**Problem:** Python-based Louvain clustering can be slow on very large graphs (>50k nodes).
**Suggestion:**
- Use Rust-backed graph libraries (like `rustworkx` or `igraph`) instead of pure Python `networkx`/`python-louvain`.
- This can speed up community detection by 10-50x.

### 3.5 Approximate Nearest Neighbors (ANN)
**Problem:** Calculating O(N^2) pairs for huge commits is expensive.
**Suggestion:**
- For massive repositories, use approximate methods or MinHash (LSH) to estimate Jaccard similarity without exhaustive pair generation.
