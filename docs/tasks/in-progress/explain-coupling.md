# Task: Explain Coupling

**Status:** Need Review

## Problem
Users see strong coupling but cannot understand why an edge is strong.

## Goal
Expose commit-level evidence and formula inputs for each edge.

## Metrics Deep Dive

When analyzing an edge between `File A` and `File B`, the following metrics are used to quantify their relationship:

| Metric | Formula / Meaning | Impact of High Value | Impact of Low Value |
| :--- | :--- | :--- | :--- |
| **Co-occurrence** | Count of commits containing both A and B. | Strong evidence of shared lifecycle. | Relationship might be accidental or rare. |
| **Jaccard Index** | $\frac{\text{Commits(A ∩ B)}}{\text{Commits(A ∪ B)}}$ | A and B are "twins"; they almost always change together. | A and B have independent lives; they rarely meet. |
| **P(B\|A)** | $\frac{\text{Commits(A ∩ B)}}{\text{Commits(A)}}$ | "Change A, and you'll likely have to change B." (Directional dependency). | A can change without affecting B. |
| **Weighted Jaccard** | Jaccard where small commits count for more than large ones. | Highly focused relationship. Small, precise changes keep these files tied. | Relationship is driven by large, potentially "noisy" mass changes. |

## Commit Examples

To understand "Why are these files coupled?", look at the commit history:

### 1. The "Feature Trio" (High Coupling)
*   **Commit 1**: `Add Login button` (files: `Login.tsx`, `Login.css`, `Login.test.tsx`)
*   **Commit 2**: `Fix Login button margin` (files: `Login.tsx`, `Login.css`)
*   **Commit 3**: `Add data-test-id to Login` (files: `Login.tsx`, `Login.test.tsx`)
*   **Result**: Extremely high Jaccard and P(B|A). These files are functionally inseparable.

### 2. The "Cross-Layer Service" (Medium Coupling, Directional)
*   **Commit 1**: `Update User API` (files: `users.service.ts`, `auth.ts`, `user.model.ts`)
*   **Commit 2**: `Change User Model field` (files: `user.model.ts`, `users.service.ts`)
*   **Result**: `user.model.ts` has many changes. `users.service.ts` often changes *with* it. P(Service | Model) is high, but P(Model | Service) might be lower if the service also changes for other reasons (e.g., logging).

### 3. The "Global Refactor" (Noise)
*   **Commit 1**: `Rename 'color' to 'themeColor' in 200 files`
*   **Result**: This creates a "fake" coupling between 200 unrelated files. 
*   **Solution**: Use `max_changeset_size` to filter these out.

## Configuration Parameters

Adjusting these parameters radically changes the sensitivity and noise level of the analysis.

| Parameter | Documentation | Big Value Impact | Low Value Impact |
| :--- | :--- | :--- | :--- |
| `min_revisions` | Min changes a file must have to be analyzed. | **Focus**: Only looks at "hot" files with stable history. Less noise. | **Exploration**: Includes rare/new files, but adds significant noise. |
| `max_changeset_size` | Max files in a single commit to be considered. | **Inclusive**: Includes refactorings and large features. Risks "spaghetti" data. | **Focused**: Only looks at atomic, logical changes. Much cleaner data. |
| `min_cooccurrence` | Min shared changes to create an edge. | **High Confidence**: Only shows relationships that happen repeatedly. | **Discovery**: Shows potential latent dependencies, but risk of accidents. |
| `changeset_mode` | How files are grouped (Commit vs Time). | `by_author_time`: Finds coupling even if dev split it into 2-3 commits. | `by_commit`: Most literal; requires dev to commit related items together. |
| `author_time_hours` | Window for grouping by time. | **Loose**: Groups everything done in a day. Catches broader context. | **Tight**: Groups only what was done in 1-2 hours. More precise. |
| `topk_edges` | Max edges to show per file. | **Full Graph**: Shows every possible connection. Hard to read. | **Simplified**: Shows only the strongest relationships. Best for UI. |

## Relevant Files
- `lfca/edges.py` (Edge calculation logic)
- `lfca/config.py` (Parameter definitions)
- `frontend/src/components/ImpactGraph.tsx` (UI Visualization)

## Next Steps
- **Commit Drill-down**: Implement an "Evidence" panel that shows the specific commits (IDs, authors, messages) that contributed to a specific coupling edge. 
- **Time-Window Analysis**: Allow the user to toggle between "Lifetime" and "Recent" coupling to see if a relationship is improving or worsening.
