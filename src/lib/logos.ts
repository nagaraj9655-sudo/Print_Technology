// Original, self-contained SVG logos for the seeded companies.
// Stored as data URLs so they persist in the company record like any uploaded logo.
// Standalone copies also live in /public for the owner to download and reuse.

const PRINT_TECHNOLOGY_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 120" role="img" aria-label="Print Technology">
  <defs>
    <linearGradient id="ptbg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#312e81"/>
      <stop offset="1" stop-color="#2563eb"/>
    </linearGradient>
  </defs>
  <rect width="120" height="120" rx="28" fill="url(#ptbg)"/>
  <g style="mix-blend-mode:screen">
    <circle cx="49" cy="45" r="19" fill="#22d3ee"/>
    <circle cx="71" cy="45" r="19" fill="#ec4899"/>
    <circle cx="60" cy="63" r="19" fill="#facc15"/>
  </g>
  <text x="60" y="105" text-anchor="middle" font-family="Arial, Helvetica, sans-serif" font-size="25" font-weight="800" fill="#ffffff" letter-spacing="2">PT</text>
</svg>`

const SHRAVAN_INFOTECH_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 120" role="img" aria-label="Shravan Infotech">
  <defs>
    <linearGradient id="sibg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#065f46"/>
      <stop offset="0.55" stop-color="#0d9488"/>
      <stop offset="1" stop-color="#0284c7"/>
    </linearGradient>
  </defs>
  <path d="M60 6 L106 32 V88 L60 114 L14 88 V32 Z" fill="url(#sibg)"/>
  <g stroke="#5eead4" stroke-width="2" opacity="0.75">
    <line x1="34" y1="42" x2="88" y2="40"/>
    <line x1="86" y1="80" x2="88" y2="40"/>
  </g>
  <g fill="#99f6e4">
    <circle cx="34" cy="42" r="4"/>
    <circle cx="86" cy="80" r="4"/>
    <circle cx="88" cy="40" r="3"/>
  </g>
  <text x="60" y="78" text-anchor="middle" font-family="Georgia, 'Times New Roman', serif" font-size="46" font-weight="700" fill="#ffffff">S</text>
</svg>`

const toDataUrl = (svg: string) => `data:image/svg+xml,${encodeURIComponent(svg)}`

export const PRINT_TECHNOLOGY_LOGO = toDataUrl(PRINT_TECHNOLOGY_SVG)
export const SHRAVAN_INFOTECH_LOGO = toDataUrl(SHRAVAN_INFOTECH_SVG)
