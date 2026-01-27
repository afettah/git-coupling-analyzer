const repoInput = document.getElementById("repoId");
const dataDirInput = document.getElementById("dataDir");
const filePathInput = document.getElementById("filePath");
const filePathsList = document.getElementById("filePaths");
const loadImpactButton = document.getElementById("loadImpact");
const loadTreeButton = document.getElementById("loadTree");
const treeContainer = document.getElementById("treeContainer");
const graphLegend = document.getElementById("graphLegend");
const svg = d3.select("#graph");
const width = Number(svg.attr("width"));
const height = Number(svg.attr("height"));

const apiBase = "";

const fetchJson = async (url) => {
  const response = await fetch(url);
  if (!response.ok) {
    const detail = await response.text();
    throw new Error(detail || response.statusText);
  }
  return response.json();
};

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

  const link = svg
    .append("g")
    .attr("stroke", "#94a3b8")
    .attr("stroke-opacity", 0.8)
    .selectAll("line")
    .data(graph.edges)
    .join("line")
    .attr("stroke-width", (d) => Math.max(1, d.weight * 5));

  const node = svg
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

  const labels = svg
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

  graphLegend.innerHTML = `
    <div><strong>Focus:</strong> ${graph.nodes.find((n) => n.id === graph.focus_id)?.path}</div>
    <div><strong>Edges:</strong> ${graph.edges.length}</div>
  `;
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
