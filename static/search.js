// Case-insensitive substring match across title, description, id, year,
// inventor, location. Shared by universe.js and mobile.js so the search
// predicate stays consistent across views.
export function searchHelper(node, query) {
  const q = query.toLowerCase();
  return (
    node.title.toLowerCase().includes(q) ||
    node.description.toLowerCase().includes(q) ||
    String(node.year).includes(q) ||
    node.id.includes(q) ||
    (node.inventor && node.inventor.toLowerCase().includes(q)) ||
    (node.location && node.location.toLowerCase().includes(q))
  );
}
