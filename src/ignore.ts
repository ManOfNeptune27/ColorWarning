/** Lines covered by a `colorwarning-ignore` comment on that line or the line above it. */
export function ignoredLines(source: string): Set<number> {
  const ignored = new Set<number>();
  const lines = source.split(/\r?\n/);
  for (let index = 0; index < lines.length; index++) {
    if (!lines[index]?.includes("colorwarning-ignore")) continue;
    const lineNumber = index + 1;
    ignored.add(lineNumber);
    ignored.add(lineNumber + 1);
  }
  return ignored;
}
