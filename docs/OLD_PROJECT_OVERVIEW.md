# Project Overview: Git Coupling Analyzer

Git Coupling Analyzer is a specialized tool designed to uncover hidden dependencies and structural relationships within a Git repository. By analyzing the co-occurrence of files in commit history, it builds a graph of "logical coupling" – identifying files that frequently change together even if they don't have explicit code references. This helps developers and architects identify hotspots, architectural drift, and potential refactoring targets.

## Architecture

The project employs a modern, decoupled client-server architecture:

-   **Backend**: A Python-based application serving as the analysis engine and API provider.
-   **Frontend**: A React-based Single Page Application (SPA) for interactive visualization and control.

---

## Backend (`lfca/`)

The backend is built as a Python package (`lfca`), exposing a REST API via **FastAPI**. It handles the heavy lifting of parsing Git logs, computing statistics, and managing data persistence.

### Key Modules & Files

*   **`lfca/api.py`**
    *   **Role**: Entry point for the REST API.
    *   **Key Methods**:
        *   `index`: Helper endpoint.
        *   `list_repositories`: Retreives the list of managed repos.
        *   `start_analysis`: Triggers the background analysis process for a repository.
        *   `get_coupling_graph`: Serves the calculated node-link data for visualization.
        *   `run_clustering`: Executes clustering algorithms on the coupling graph.

*   **`lfca/git.py`**
    *   **Role**: Wrapper around Git command-line operations.
    *   **Key Methods**:
        *   `iter_log`: A generator that yields commit objects by parsing `git log` output.
        *   `get_remote_url`: Extracts origin information.

*   **`lfca/extract.py`** & **`lfca/runner.py`**
    *   **Role**: Orchestrate the extraction of data (ETL) from Git history into the internal database.

*   **`lfca/clustering/`**
    *   **Role**: Contains logic for community detection algorithms (e.g., Louvain) to group coupled files into "clusters" or "components".

*   **`lfca/storage.py`**
    *   **Role**: Manages data persistence, likely interacting with a local database or file-based storage to save analysis results (commits, file stats, coupling pairs).

---

## Frontend (`frontend/`)

The frontend is a modern web application built with **React**, **TypeScript**, and **Vite**. It uses **TailwindCSS** for styling and leverages powerful visualization libraries like **D3.js** and **Three.js** (via React Three Fiber).

### Key Directories & Files

*   **`frontend/src/api.ts`**
    *   **Role**: The API client layer. It defines TypeScript interfaces for all backend data structures and functions for every API endpoint.
    *   **Key Methods**:
        *   `getRepos`: Fetches the list of repositories.
        *   `startAnalysis`: Sends the configuration to start backend processing.
        *   `getCouplingGraph`: Requests graph data for the visualization.

*   **`frontend/src/components/`**
    *   **Role**: Contains all UI building blocks.
    *   Likely includes components for:
        *   **File Tree**: Exploring the repository structure.
        *   **Coupling Graph**: Interactive node-link diagram (possibly D3 or Three.js).
        *   **Cluster View**: Visualizing the results of clustering algorithms (possibly utilizing Excalidraw).
        *   **Dashboard**: High-level metrics and charts.
    
*   **`frontend/src/App.tsx`** & **`frontend/src/main.tsx`**
    *   **Role**: Application entry point and routing configuration (using `react-router-dom`).

*   **`frontend/package.json`**
    *   **Role**: Defines dependencies. Notable libraries include `@excalidraw/excalidraw`, `d3`, `three`, and `@react-three/fiber`, indicating a heavy focus on rich, interactive visualizations.

---

## Data Flow

### 1. Repository Initialization
*   **User Action**: Enters a local file path to a Git repository in the Frontend.
*   **Flow**: Frontend -> `api.createRepo` -> Backend `lfca.api.create_repository`.
*   **Result**: Backend validates the path and initializes a storage entry.

### 2. Analysis Execution
*   **User Action**: Clicks "Start Analysis" and configures parameters (e.g., commit window, file filters).
*   **Flow**: Frontend -> `api.startAnalysis` -> Backend `lfca.api.start_analysis`.
*   **Processing**:
    *   `lfca.runner` triggers the extraction pipeline.
    *   `lfca.git.iter_log` streams commit data.
    *   Files are tracked, and "coupling" is calculated based on how often files appear in the same commit (Jaccard Index).
    *   Results are saved via `lfca.storage`.

### 3. Visualization & Exploration
*   **User Action**: Navigates to "Coupling Graph" or "Clustering" changes view options.
*   **Flow**: Frontend -> `api.getCouplingGraph` / `api.runClustering` -> Backend.
*   **Response**: Backend queries specific analysis results, computes the graph layout or clusters on-the-fly (or from cache), and returns JSON.
*   **Rendering**: Frontend components (D3/Three.js) take the JSON data and render the interactive graph, allowing users to zoom, filter, and inspect specific nodes.

---

## Key Features

1.  **Logical Coupling Analysis**: Detects dependencies that static analysis tools miss by looking at temporal co-evolution of files.
2.  **Interactive Graph Visualization**: Explore the codebase as a network of interconnected files.
3.  **Clustering & Community Detection**: Automatically group files into "components" to see the high-level architecture.
4.  **Temporal Analysis**: (Inferred from data structures) Analyze how coupling changes over time.
5.  **Hotspot Detection**: Identify files with high churn and high coupling (high risk).
6.  **Excalidraw Integration**: (Inferred from dependencies) Ability to visualize or annotate architectural diagrams.
