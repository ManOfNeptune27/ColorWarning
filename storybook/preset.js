export function managerEntries(entry = []) {
  return [...entry, import.meta.resolve("./manager.js")];
}

export function previewAnnotations(entry = []) {
  return [...entry, import.meta.resolve("./preview.js")];
}

export default { managerEntries, previewAnnotations };
