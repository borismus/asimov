export async function loadGraph(csvUrl) {
  const rows = await d3.csv('asimov-1700.csv');

  // Get all nodes.
  const nodes = rows.map(row => ({
    id: row.ID,
    title: row['Discovery / Invention'],
    year: row.Date,
    deps: row.Deps,
    url: row.URL,
  }));

  // Get all links from the raw data.
  const links = [];
  const ids = rows.map(row => row.ID);
  const deps = rows.map(row => row.Dependencies);

  for (let [firstIndex, nodeId] of deps.entries()) {
    if (!nodeId) {
      console.info(`No dependencies listed for ${nodeId}.`);
      continue;
    }
    // If an ID of a row is also listed as a dependency of the row (there can
    // only be one for now), the nodes are linked.
    const secondIndex = ids.indexOf(nodeId);
    if (secondIndex >= 0) {
      links.push({
        source: firstIndex,
        target: secondIndex
      });
    } else {
      console.warn(`Found no dependency named ${nodeId}.`);
    }
  }
  console.log(`Found ${links.length} links.`);
  return {
    nodes,
    links
  };
}
