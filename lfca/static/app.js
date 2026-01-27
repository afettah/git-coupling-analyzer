const repoInput = document.getElementById("repoId");
const dataDirInput = document.getElementById("dataDir");
const repoPathInput = document.getElementById("repoPath");
const sinceInput = document.getElementById("sinceDate");
const untilInput = document.getElementById("untilDate");
const filePathInput = document.getElementById("filePath");
const filePathsList = document.getElementById("filePaths");
const loadImpactButton = document.getElementById("loadImpact");
const loadTreeButton = document.getElementById("loadTree");
const startAnalysisButton = document.getElementById("startAnalysis");
const treeContainer = document.getElementById("treeContainer");
const graphLegend = document.getElementById("graphLegend");
const focusPath = document.getElementById("focusPath");
const focusStats = document.getElementById("focusStats");
const impactList = document.getElementById("impactList");
const folderImpactList = document.getElementById("folderImpactList");
const lineageList = document.getElementById("lineageList");
const analysisStatus = document.getElementById("analysisStatus");
const analysisProgress = document.getElementById("analysisProgress");
const analysisMeta = document.getElementById("analysisMeta");
const clusterAlgorithm = document.getElementById("clusterAlgorithm");
const clusterMinWeight = document.getElementById("clusterMinWeight");
const clusterFolders = document.getElementById("clusterFolders");
const startClusterButton = document.getElementById("startCluster");
const clusterStatus = document.getElementById("clusterStatus");
const clusterResults = document.getElementById("clusterResults");
const svg = d3.select("#graph");
const width = Number(svg.attr("width"));
const height = Number(svg.attr("height"));

const apiBase = "";

const fetchJson = async (url, options = {}) => {
  const finalOptions = { ...options };
  if (finalOptions.body && !finalOptions.headers) {
    finalOptions.headers = { "Content-Type": "application/json" };
  }
  const response = await fetch(url, finalOptions);
  if (!response.ok) {
    const detail = await response.text();
    throw new Error(detail || response.statusText);
  }
  return response.json();
};

const postJson = (url, payload) =>
  fetchJson(url, { method: "POST", body: JSON.stringify(payload) });

const clusterRunIdKey = (repoId) => `lfca:clusterRun:${repoId}`;

const loadFileSuggestions = async () => {
  const repoId = repoInput.value.trim();
  const dataDir = dataDirInput.value.trim();
  const query = filePathInput.value.trim();
  if (!repoId) {
    return;
  }
  const params = new URLSearchParams({ data_dir: dataDir, limit: "200" });
  if (query) {
    params.append("q", query);
  }
  const results = await fetchJson(`${apiBase}/repos/${repoId}/files?${params}`);
  filePathsList.innerHTML = "";
  results.forEach((path) => {
    const option = document.createElement("option");
    option.value = path;
    filePathsList.appendChild(option);
  });
};

const renderTree = (tree) => {
  const ul = document.createElement("ul");
  Object.entries(tree).forEach(([name, subtree]) => {
    const li = document.createElement("li");
    const button = document.createElement("button");
    button.type = "button";
    button.textContent = name;
    button.className = "tree-node";
    button.addEventListener("click", () => {
      const path = collectPath(button);
      filePathInput.value = path;
      loadFileSuggestions().catch(() => {});
    });
    li.appendChild(button);
    if (Object.keys(subtree).length > 0) {
      li.appendChild(renderTree(subtree));
    }
    ul.appendChild(li);
  });
  return ul;
};

const collectPath = (button) => {
  const parts = [];
  let current = button;
  while (current) {
    if (current.classList && current.classList.contains("tree-node")) {
      parts.unshift(current.textContent);
    }
    current = current.parentElement;
    if (!current) {
      break;
    }
    current = current.parentElement;
  }
  return parts.join("/");
};

const loadTree = async () => {
  const repoId = repoInput.value.trim();
  const dataDir = dataDirInput.value.trim();
  if (!repoId) {
    treeContainer.textContent = "Enter a repo id first.";
    return;
  }
  treeContainer.textContent = "Loading tree...";
  const tree = await fetchJson(
    `${apiBase}/repos/${repoId}/folders/tree?${new URLSearchParams({ data_dir: dataDir })}`
  );
  treeContainer.innerHTML = "";
  treeContainer.appendChild(renderTree(tree));
};

const renderGraph = (graph) => {
  svg.selectAll("*").remove();
  graphLegend.innerHTML = "";
  focusPath.textContent = "";
  focusStats.textContent = "";

  const graphGroup = svg.append("g");

  const link = graphGroup
    .append("g")
    .attr("stroke", "#94a3b8")
    .attr("stroke-opacity", 0.8)
    .selectAll("line")
    .data(graph.edges)
    .join("line")
    .attr("stroke-width", (d) => Math.max(1, d.weight * 5));

  const node = graphGroup
    .append("g")
    .attr("stroke", "#0f172a")
    .attr("stroke-width", 1)
    .selectAll("circle")
    .data(graph.nodes)
    .join("circle")
    .attr("r", (d) => (d.id === graph.focus_id ? 10 : 6))
    .attr("fill", (d) => (d.id === graph.focus_id ? "#2563eb" : "#38bdf8"))
    .call(
      d3
        .drag()
        .on("start", (event, d) => {
          if (!event.active) simulation.alphaTarget(0.3).restart();
          d.fx = d.x;
          d.fy = d.y;
        })
        .on("drag", (event, d) => {
          d.fx = event.x;
          d.fy = event.y;
        })
        .on("end", (event, d) => {
          if (!event.active) simulation.alphaTarget(0);
          d.fx = null;
          d.fy = null;
        })
    );

  node.append("title").text((d) => d.path);

  const labels = graphGroup
    .append("g")
    .selectAll("text")
    .data(graph.nodes)
    .join("text")
    .attr("class", "node-label")
    .text((d) => d.path);

  const simulation = d3
    .forceSimulation(graph.nodes)
    .force("link", d3.forceLink(graph.edges).id((d) => d.id).distance(140))
    .force("charge", d3.forceManyBody().strength(-300))
    .force("center", d3.forceCenter(width / 2, height / 2));

  simulation.on("tick", () => {
    link
      .attr("x1", (d) => d.source.x)
      .attr("y1", (d) => d.source.y)
      .attr("x2", (d) => d.target.x)
      .attr("y2", (d) => d.target.y);
    node.attr("cx", (d) => d.x).attr("cy", (d) => d.y);
    labels.attr("x", (d) => d.x + 10).attr("y", (d) => d.y + 4);
  });

  svg.call(
    d3.zoom().scaleExtent([0.4, 2.5]).on("zoom", (event) => {
      graphGroup.attr("transform", event.transform);
    })
  );

  const focusNode = graph.nodes.find((n) => n.id === graph.focus_id);
  focusPath.textContent = focusNode?.path ?? "";
  focusStats.textContent = `${graph.nodes.length} nodes · ${graph.edges.length} edges`;
  graphLegend.innerHTML = `
    <div><strong>Focus:</strong> ${focusNode?.path ?? "Unknown"}</div>
    <div><strong>Nodes:</strong> ${graph.nodes.length}</div>
    <div><strong>Edges:</strong> ${graph.edges.length}</div>
  `;
};

const renderImpactList = (rows) => {
  impactList.innerHTML = "";
  if (!rows.length) {
    impactList.innerHTML = "<li>No impacts found.</li>";
    return;
  }
  rows.forEach((row) => {
    const li = document.createElement("li");
    li.innerHTML = `<span class="mono">${row.path ?? "unknown"}</span><span>${row.weight_jaccard.toFixed(
      3
    )}</span>`;
    impactList.appendChild(li);
  });
};

const renderFolderImpacts = (rows) => {
  folderImpactList.innerHTML = "";
  if (!rows.length) {
    folderImpactList.innerHTML = "<li>No folder impacts found.</li>";
    return;
  }
  rows.forEach((row) => {
    const li = document.createElement("li");
    li.innerHTML = `<span class="mono">${row.folder}</span><span>${row.weight_total.toFixed(3)}</span>`;
    folderImpactList.appendChild(li);
  });
};

const renderLineage = (rows) => {
  lineageList.innerHTML = "";
  if (!rows.length) {
    lineageList.innerHTML = "<li>No lineage data found.</li>";
    return;
  }
  rows.forEach((row) => {
    const li = document.createElement("li");
    const endLabel = row.end_commit_oid ? row.end_commit_oid.slice(0, 8) : "present";
    li.innerHTML = `<span class="mono">${row.path}</span><span>${row.start_commit_oid.slice(
      0,
      8
    )} → ${endLabel}</span>`;
    lineageList.appendChild(li);
  });
};

const loadImpact = async () => {
  const repoId = repoInput.value.trim();
  const dataDir = dataDirInput.value.trim();
  const filePath = filePathInput.value.trim();
  const topEdges = document.getElementById("topEdges").value;
  if (!repoId || !filePath) {
    graphLegend.textContent = "Enter a repo id and file path.";
    return;
  }
  graphLegend.textContent = "Loading graph...";
  const params = new URLSearchParams({
    data_dir: dataDir,
    path: filePath,
    top: topEdges,
  });
  const graph = await fetchJson(`${apiBase}/repos/${repoId}/impact/graph?${params}`);
  renderGraph(graph);

  const impacts = await fetchJson(`${apiBase}/repos/${repoId}/impact?${params}`);
  const nodePaths = new Map(graph.nodes.map((node) => [node.id, node.path]));
  const impactsWithPath = impacts.map((row) => ({
    ...row,
    path: nodePaths.get(row.src_file_id === graph.focus_id ? row.dst_file_id : row.src_file_id),
  }));
  renderImpactList(impactsWithPath);

  const folderParams = new URLSearchParams({
    data_dir: dataDir,
    path: filePath,
    top: "8",
    depth: "2",
  });
  const folderImpacts = await fetchJson(
    `${apiBase}/repos/${repoId}/impact/folders?${folderParams}`
  );
  renderFolderImpacts(folderImpacts);

  const lineage = await fetchJson(
    `${apiBase}/repos/${repoId}/files/${encodeURIComponent(filePath)}/lineage?${new URLSearchParams({
      data_dir: dataDir,
    })}`
  );
  renderLineage(lineage);
};

const renderAnalysisStatus = (status) => {
  if (!status || status.state === "not_started") {
    analysisStatus.textContent = "No analysis started.";
    analysisMeta.textContent = "";
    analysisProgress.style.width = "0%";
    return;
  }
  const processed = status.processed_commits ?? 0;
  const total = status.total_commits ?? 0;
  const percent = Math.round((status.progress ?? 0) * 100);
  analysisStatus.textContent = `${status.state} · ${status.stage ?? "idle"}`;
  analysisMeta.textContent = total
    ? `${processed} / ${total} commits (${percent}%)`
    : `${processed} commits processed`;
  analysisProgress.style.width = `${percent}%`;
};

const loadAnalysisStatus = async () => {
  const repoId = repoInput.value.trim();
  const dataDir = dataDirInput.value.trim();
  if (!repoId) {
    return;
  }
  const status = await fetchJson(
    `${apiBase}/repos/${repoId}/analysis/status?${new URLSearchParams({ data_dir: dataDir })}`
  );
  renderAnalysisStatus(status);
  return status;
};

const startAnalysis = async () => {
  const repoId = repoInput.value.trim();
  const dataDir = dataDirInput.value.trim();
  const repoPath = repoPathInput.value.trim();
  if (!repoId || !repoPath) {
    analysisStatus.textContent = "Enter repo id and repo path to start analysis.";
    return;
  }
  analysisStatus.textContent = "Starting analysis...";
  await postJson(`${apiBase}/repos/${repoId}/analysis/start`, {
    repo_path: repoPath,
    since: sinceInput.value.trim() || null,
    until: untilInput.value.trim() || null,
    data_dir: dataDir,
  });
  await loadAnalysisStatus();
};

const renderClusterStatus = (status) => {
  if (!status || status.state === "not_started") {
    clusterStatus.textContent = "No clustering run yet.";
    return;
  }
  clusterStatus.textContent = `${status.state} · ${status.stage ?? "idle"}`;
};

const renderClusterResults = (results) => {
  if (!results) {
    clusterResults.textContent = "";
    return;
  }
  if (!results.clusters?.length) {
    clusterResults.innerHTML = "<p>No clusters found.</p>";
    return;
  }
  const topClusters = results.clusters.slice(0, 5);
  clusterResults.innerHTML = `
    <div class="cluster-summary">Top ${topClusters.length} clusters (of ${
    results.cluster_count
  })</div>
    <ul>
      ${topClusters
        .map(
          (cluster) => `
        <li>
          <div class="cluster-title">Cluster ${cluster.id} · ${cluster.size} files</div>
          <div class="cluster-files">${cluster.files.slice(0, 5).join("<br />")}</div>
        </li>
      `
        )
        .join("")}
    </ul>
  `;
};

const loadClusterStatus = async (runId) => {
  const repoId = repoInput.value.trim();
  const dataDir = dataDirInput.value.trim();
  if (!repoId || !runId) {
    return null;
  }
  const status = await fetchJson(
    `${apiBase}/repos/${repoId}/clusters/${runId}/status?${new URLSearchParams({
      data_dir: dataDir,
    })}`
  );
  renderClusterStatus(status);
  return status;
};

const loadClusterResults = async (runId) => {
  const repoId = repoInput.value.trim();
  const dataDir = dataDirInput.value.trim();
  if (!repoId || !runId) {
    return;
  }
  const results = await fetchJson(
    `${apiBase}/repos/${repoId}/clusters/${runId}?${new URLSearchParams({ data_dir: dataDir })}`
  );
  renderClusterResults(results);
};

const startCluster = async () => {
  const repoId = repoInput.value.trim();
  const dataDir = dataDirInput.value.trim();
  if (!repoId) {
    clusterStatus.textContent = "Enter a repo id first.";
    return;
  }
  clusterStatus.textContent = "Starting clustering...";
  const folders = clusterFolders.value
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean);
  const response = await postJson(`${apiBase}/repos/${repoId}/clusters/start`, {
    algorithm: clusterAlgorithm.value,
    min_weight: Number(clusterMinWeight.value || 0),
    folders,
    data_dir: dataDir,
  });
  localStorage.setItem(clusterRunIdKey(repoId), response.run_id);
  await loadClusterStatus(response.run_id);
};

filePathInput.addEventListener("input", () => {
  loadFileSuggestions().catch(() => {});
});

loadImpactButton.addEventListener("click", () => {
  loadImpact().catch((err) => {
    graphLegend.textContent = `Error: ${err.message}`;
  });
});

loadTreeButton.addEventListener("click", () => {
  loadTree().catch((err) => {
    treeContainer.textContent = `Error: ${err.message}`;
  });
});

startAnalysisButton.addEventListener("click", () => {
  startAnalysis().catch((err) => {
    analysisStatus.textContent = `Error: ${err.message}`;
  });
});

startClusterButton.addEventListener("click", () => {
  startCluster().catch((err) => {
    clusterStatus.textContent = `Error: ${err.message}`;
  });
});

const refreshStatus = async () => {
  const analysis = await loadAnalysisStatus().catch(() => null);
  const repoId = repoInput.value.trim();
  if (repoId) {
    const runId = localStorage.getItem(clusterRunIdKey(repoId));
    const status = await loadClusterStatus(runId).catch(() => null);
    if (status?.state === "complete") {
      await loadClusterResults(runId).catch(() => null);
    }
  }
  if (analysis?.state === "complete") {
    loadFileSuggestions().catch(() => {});
  }
};

refreshStatus().catch(() => {});
setInterval(() => {
  refreshStatus().catch(() => {});
}, 5000);
