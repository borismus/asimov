export function formatYear(yearNumber) {
  if (yearNumber < 0) {
    return `${formatWithCommas(-yearNumber)} BCE`;
  } else {
    return yearNumber;
  }
}

function formatWithCommas(num) {
  return num.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",");
}

export function parseYear(date) {
  let [year, suffix] = date.split(" ");
  suffix = suffix ? suffix.toLowerCase() : "";
  const isBce = suffix.indexOf("bc") >= 0;
  year = Number(year);
  return year * (isBce ? -1 : 1);
}

export function formatField(field) {
  return field.split(":")[0].toLowerCase();
}

const VALID_FIELDS = [
  "general",
  "science",
  "space",
  "math",
  "culture",
  "war",
  "design",
  "geography",
];

function validateData(nodes) {
  let isValid = true;
  // Check for duplicate IDs.
  const ids = nodes.map((row) => row.id);
  const dupes = ids.filter((e, i, a) => a.indexOf(e) !== i);
  if (dupes.length > 0) {
    console.warn(`Found ${dupes.length} duplicate IDs.`);
    console.warn(dupes);
    isValid = false;
  }
  // Check for missing dependencies.
  for (const node of nodes) {
    for (const dep of node.deps) {
      if (!ids.includes(dep)) {
        console.warn(`Found missing dependency ${dep} for node ${node.id}.`);
        isValid = false;
        continue;
      }
      if (dep === node.id) {
        console.warn(`Found self-referencing dependency for node ${node.id}.`);
        isValid = false;
      }
      // Ensure the dependency came before the node.
      const depIndex = ids.indexOf(dep);
      const depYear = nodes[depIndex].year;
      if (depYear > node.year) {
        console.warn(
          `Node ${node.id} (${node.year}) has dependency from the future ${dep} (${depYear}).`
        );
        isValid = false;
      }
    }
  }

  // Check for nonsensical fields.
  const fields = nodes.map((node) => formatField(node.field));
  for (const field of new Set(fields)) {
    if (!VALID_FIELDS.includes(field)) {
      console.warn(`Found invalid field ${field}.`);
      isValid = false;
    }
  }

  // Warn about nodes that don't depend on anything and are not linked.
  const independentNodes = nodes.filter((node) => node.deps.length === 0);
  for (const node of independentNodes) {
    let linked = false;
    for (const otherNode of nodes) {
      if (otherNode.deps.includes(node.id)) {
        linked = true;
      }
    }
    if (!linked) {
      console.warn(
        `Card #${node.id} has no dependencies and nothing depends on it.`
      );
    }
  }

  return isValid;
}

export async function loadGraph(tsvUrl) {
  const rows = await d3.tsv(tsvUrl);

  const integer = Math.floor(Math.random() * 1000);
  const imageWidth = 240;
  const imageAspect = 16.0 / 9.0;
  const imageHeight = imageWidth / imageAspect;

  // Get all nodes.
  const nodes = rows.map((row) => ({
    id: row.ID,
    year: parseYear(row.Year),
    deps: parseDeps(row.Dependencies),
    title: row.Title,
    description: row.Description,
    inventor: row.Inventor,
    location: row.Location,
    field: row.Field.toLowerCase() || "unknown",
    url: row.URL,
  }));

  if (!validateData(nodes)) {
    console.error("Data is invalid.");
  }

  // Get all links from the raw data.
  const links = [];
  const ids = nodes.map((node) => node.id);
  const deps = nodes.map((node) => node.deps);

  for (let [targetIndex, depIds] of deps.entries()) {
    if (!depIds) {
      continue;
    }
    // If an ID of a row is also listed as a dependency of the row (there can
    // only be one for now), the nodes are linked.
    for (const depId of depIds) {
      const sourceIndex = ids.indexOf(depId);
      if (sourceIndex >= 0) {
        links.push({
          source: nodes[sourceIndex],
          target: nodes[targetIndex],
        });
      } else {
        console.warn(`Found no entry for ${depId}.`);
      }
    }
  }
  console.log(`Found ${links.length} links.`);
  return {
    nodes,
    links,
  };
}

function parseDeps(depsString) {
  if (!depsString) {
    return [];
  }
  return depsString.split(",").map((dep) => dep.trim());
}

export function isMobile() {
  return /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
}
