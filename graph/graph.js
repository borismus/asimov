import {parseYear} from './utils.js';

export async function loadGraph(csvUrl) {
  const rows = await d3.csv('asimov-1700.csv');

  // Get all nodes.
  const nodes = rows.map(row => ({
    id: row.ID,
    year: parseYear(row.Date),
    deps: row.Deps,
    url: row.URL,
  }));

  // Get all links from the raw data.
  const links = [];
  const ids = rows.map(row => row.ID);
  const deps = rows.map(row => row.Dependencies);

  for (let [targetIndex, depId] of deps.entries()) {
    if (!depId) {
      console.info(`No dependencies listed for ${depId}.`);
      continue;
    }
    // If an ID of a row is also listed as a dependency of the row (there can
    // only be one for now), the nodes are linked.
    const sourceIndex = ids.indexOf(depId);
    if (sourceIndex >= 0) {
      links.push({
        source: ids[sourceIndex],
        target: ids[targetIndex],
      });
    } else {
      console.warn(`Found no dependency for ${depId}.`);
    }
  }
  console.log(`Found ${links.length} links.`);
  return {
    nodes,
    links
  };
}
