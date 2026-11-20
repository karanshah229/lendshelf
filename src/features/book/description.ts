/**
 * Open Library descriptions often carry Markdown links, source notes and an
 * "Also contained in" footer separated by a dashed rule. Keep just the prose.
 */
export function cleanDescription(raw: string | null | undefined): string | null {
  if (!raw) return null;
  let text = raw.replace(/\r\n?/g, '\n');
  // Cut at a horizontal rule ("----------") and everything after it.
  text = text.split(/\n\s*-{3,}\s*(\n|$)/)[0] ?? text;
  text = text
    // ([source][1]) / ([source](https://…)) notes
    .replace(/\(\s*\[source\]\s*(\[[^\]]*\]|\([^)]*\))\s*\)/gi, '')
    // [text](url) and [text][1] → text
    .replace(/\[([^\]]+)\]\((?:[^)]+)\)/g, '$1')
    .replace(/\[([^\]]+)\]\[[^\]]*\]/g, '$1')
    // reference definitions: "[1]: https://…"
    .replace(/^\s*\[[^\]]+\]:\s*\S+.*$/gm, '')
    // bold/italic markers
    .replace(/(\*\*|__)(.+?)\1/g, '$2')
    // space left before punctuation by removed notes
    .replace(/[ \t]+([.,;:!?])/g, '$1')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
  return text || null;
}
