export const runtime = "edge";

function renderBadge(domain: string): string {
  const W = 280;
  const H = 80;

  const bg = "#0d1117";
  const accent = "#58a6ff";
  const textLight = "#ffffff";
  const border = "#30363d";

  const font =
    "ui-monospace, SFMono-Regular, SF Mono, Menlo, Consolas, Liberation Mono, monospace";

  const terminalIcon = `
    <g transform="translate(24, 25)">
      <rect x="0" y="0" width="30" height="22" rx="3" fill="none" stroke="${accent}" stroke-width="1.5"/>
      <path d="M6 8 L12 14 L6 20" fill="none" stroke="${accent}" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
      <line x1="14" y1="20" x2="24" y2="20" stroke="${accent}" stroke-width="1.5" stroke-linecap="round"/>
    </g>
  `;

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
  <rect width="${W}" height="${H}" rx="10" fill="${bg}"/>
  <rect x="0.5" y="0.5" width="${W - 1}" height="${H - 1}" rx="10" fill="none" stroke="${border}"/>

  ${terminalIcon}

  <text x="68" y="38" fill="${textLight}" font-size="18" font-weight="600" font-family="${font}">${domain}</text>
  <text x="68" y="56" fill="${accent}" font-size="12" font-family="${font}">security researcher</text>
</svg>`;
}

export async function GET(req: Request) {
  const url = new URL(req.url);
  const domain = url.searchParams.get("d") || "qyrn.dev";

  const svg = renderBadge(domain);

  return new Response(svg, {
    headers: {
      "Content-Type": "image/svg+xml; charset=utf-8",
      "Cache-Control": "public, max-age=0, s-maxage=86400, stale-while-revalidate=86400",
    },
  });
}
