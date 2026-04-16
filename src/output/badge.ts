/**
 * Generate a shields.io-style SVG badge for the agent hygiene score.
 *
 * The SVG is hand-templated — no external dependency needed. The layout
 * mirrors the shields.io "flat" style: a dark-gray left half with the
 * label ("agent hygiene") and a colored right half with the score value.
 */

// ── Color mapping ─────────────────────────────────────────────────

function gradeColor(grade: string): string {
  if (grade.startsWith("A")) return "#4c1"; // bright green
  if (grade === "B+" || grade === "B") return "#97ca00"; // green
  if (grade === "B-" || grade === "C+") return "#dfb317"; // yellow
  if (grade === "C" || grade === "C-") return "#fe7d37"; // orange
  return "#e05d44"; // red (D+, D, D-, F)
}

// ── SVG template ──────────────────────────────────────────────────

export function generateBadgeSvg(score: number, grade: string): string {
  const label = "agent hygiene";
  const value = `${score}/100`;
  const color = gradeColor(grade);

  // Approximate text widths (6.5px per char for the 11px Verdana used by shields.io)
  const labelWidth = Math.round(label.length * 6.5) + 10;
  const valueWidth = Math.round(value.length * 6.5) + 10;
  const totalWidth = labelWidth + valueWidth;

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${totalWidth}" height="20" role="img" aria-label="${label}: ${value}">
  <title>${label}: ${value}</title>
  <linearGradient id="s" x2="0" y2="100%">
    <stop offset="0" stop-color="#bbb" stop-opacity=".1"/>
    <stop offset="1" stop-opacity=".1"/>
  </linearGradient>
  <clipPath id="r">
    <rect width="${totalWidth}" height="20" rx="3" fill="#fff"/>
  </clipPath>
  <g clip-path="url(#r)">
    <rect width="${labelWidth}" height="20" fill="#555"/>
    <rect x="${labelWidth}" width="${valueWidth}" height="20" fill="${color}"/>
    <rect width="${totalWidth}" height="20" fill="url(#s)"/>
  </g>
  <g fill="#fff" text-anchor="middle" font-family="Verdana,Geneva,DejaVu Sans,sans-serif" text-rendering="geometricPrecision" font-size="11">
    <text x="${labelWidth / 2}" y="15" fill="#010101" fill-opacity=".3">${label}</text>
    <text x="${labelWidth / 2}" y="14" fill="#fff">${label}</text>
    <text x="${labelWidth + valueWidth / 2}" y="15" fill="#010101" fill-opacity=".3">${value}</text>
    <text x="${labelWidth + valueWidth / 2}" y="14" fill="#fff">${value}</text>
  </g>
</svg>`;
}

/**
 * Generate a Markdown snippet for embedding the badge.
 */
export function badgeMarkdownSnippet(filePath: string): string {
  return `![Agent Hygiene Score](${filePath})`;
}
