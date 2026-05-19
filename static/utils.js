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

// Card kinds. `legacy` (Asimov's corpus) and `added` (verified gap-fillers /
// post-1993 entries that actually happened) are fixed; speculative future
// cards use `scenario-<slug>` so each "cone of possibilities" has its own
// kind. isSpeculative() is the catch-all predicate.
const FIXED_KINDS = new Set(["legacy", "added"]);
const seenUnknownKinds = new Set();

export function normalizeKind(raw) {
  const k = (raw || "").trim() || "legacy";
  if (FIXED_KINDS.has(k) || k.startsWith("scenario-")) return k;
  if (!seenUnknownKinds.has(k)) {
    console.warn(`Unknown Kind value "${k}" — treating as legacy.`);
    seenUnknownKinds.add(k);
  }
  return "legacy";
}

export const isSpeculative = (n) => n.kind && n.kind.startsWith("scenario-");

export const scenarioOf = (n) =>
  isSpeculative(n) ? n.kind.slice("scenario-".length) : null;

export function validateData(nodes) {
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

  // Soft hint: a speculative card with a year already in the past is
  // probably mislabeled and should be `added` (it actually happened).
  const nowYear = new Date().getFullYear();
  for (const node of nodes) {
    if (isSpeculative(node) && node.year < nowYear) {
      console.warn(
        `Speculative node ${node.id} (${node.kind}) has year ${node.year} (in the past) — should it be 'added'?`
      );
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

// fetch-tsv.py writes with escapechar="\\"; d3.tsv does not unescape on read.
function unescapeTsvCell(value) {
  if (value == null || value === "") return value ?? "";
  return String(value).replace(/\\"/g, '"').replace(/\\\\/g, "\\");
}

export async function loadGraph(tsvUrl) {
  const rows = await d3.tsv(tsvUrl);

  // Get all nodes.
  const nodes = rows.map((row) => ({
    id: row.ID,
    year: parseYear(row.Year),
    deps: parseDeps(row.Dependencies),
    title: unescapeTsvCell(row.Title),
    description: unescapeTsvCell(row.Description),
    inventor: unescapeTsvCell(row.Inventor),
    location: unescapeTsvCell(row.Location),
    field: (unescapeTsvCell(row.Field) || "unknown").toLowerCase(),
    url: unescapeTsvCell(row.URL),
    kind: normalizeKind(row.Kind),
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
        const dependingNode = nodes[targetIndex];
        console.warn(`Found no entry for ${depId}.`, dependingNode);
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
