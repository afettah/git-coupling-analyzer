# QA Testing Strategy

**Status:** Reference Document  
**Last Updated:** January 31, 2026  
**Reference Project:** OpenHands

---

## Overview

Quality Assurance strategy for validating LFCA system correctness using OpenHands as reference project.

---

## Test Categories

### 1. Repository Statistics Validation

Validate extraction completeness by comparing with git commands:

```bash
# Basic counts
git rev-list --count HEAD              # Total commits
git ls-tree -r HEAD --name-only | wc -l # Current files
git log --merges --oneline | wc -l     # Merge commits
git log --format='%ae' | sort -u | wc -l # Unique authors
```

### 2. Coupling Ground Truth

Known patterns to validate:

| Pattern | Expected Behavior |
|---------|-------------------|
| Test/implementation pairs | `test_X.py ↔ X.py` should show high coupling |
| Config consumers | `config.py` coupled with files that import it |
| Files always alone | Should show zero coupling |
| Files never alone | Should show high coupling |

### 3. Manual Test Cases

#### Case 1: Hot File Detection
1. Run analysis on OpenHands
2. Navigate to Folder Tree
3. Enable "Hot Files" filter
4. Verify top files match: `git log --name-only --pretty=format: | sort | uniq -c | sort -rn | head -20`

#### Case 2: Coupling Accuracy
1. Select a known coupled pair
2. Check Jaccard score
3. Verify with manual commit analysis

#### Case 3: Cluster Coherence
1. Run clustering (Louvain)
2. Inspect generated clusters
3. Verify files in same cluster share logical relationship

---

## Validation Scripts

### File Change Frequency

```bash
#!/bin/bash
# file_change_frequency.sh
git log --name-only --pretty=format: | \
    grep -v '^$' | sort | uniq -c | sort -rn
```

### Co-change Pairs

```bash
#!/bin/bash
# Find files that change together frequently
git log --name-only --pretty=format:'---COMMIT---' | \
    awk '/^---COMMIT---/ { n=0; delete files; next }
         NF>0 { files[n++]=$0 }
         /^$/ && n>=2 { for(i=0;i<n-1;i++) for(j=i+1;j<n;j++)
           print files[i]","files[j] }' | sort | uniq -c | sort -rn | head -20
```

---

## Acceptance Criteria

- [ ] Total commit count matches `git rev-list --count HEAD`
- [ ] Current file count matches `git ls-tree -r HEAD | wc -l`
- [ ] Top 10 hottest files match git analysis
- [ ] Known coupled pairs show Jaccard > 0.5
- [ ] Isolated files show Jaccard < 0.1
- [ ] Clusters contain logically related files
