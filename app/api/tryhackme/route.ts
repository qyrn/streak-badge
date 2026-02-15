export const runtime = "edge";

interface THMData {
  username: string;
  rank: string;
  points: string;
  rooms: string;
  streak: string;
}

async function fetchTHMData(userId: string): Promise<THMData> {
  const res = await fetch(
    `https://tryhackme.com/api/v2/badges/public-profile?userPublicId=${userId}`,
    {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
      },
    }
  );

  if (!res.ok) throw new Error(`TryHackMe API error: ${res.status}`);

  const html = await res.text();

  const usernameMatch = html.match(/tryhackme\.com\/p\/([^"']+)/);
  const username = usernameMatch?.[1] ?? "unknown";

  const rankMatch = html.match(/\[0x([0-9A-Fa-f]+)\]/);
  const rank = rankMatch ? `0x${rankMatch[1]}` : "N/A";

  const pointsMatch = html.match(/>(\d[\d,]+)</);
  const points = pointsMatch?.[1] ?? "0";

  const streakMatch = html.match(/fire[^>]*>[^<]*?(\d+)/i);
  const streak = streakMatch?.[1] ?? "0";

  const roomsMatch = html.match(/door[^>]*>[^<]*?(\d+)/i);
  const rooms = roomsMatch?.[1] ?? "0";

  return { username, rank, points, rooms, streak };
}

function renderBadge(data: THMData): string {
  const W = 400;
  const H = 140;

  const bg = "#1c2538";
  const accent = "#88cc14";
  const textLight = "#ffffff";
  const textMuted = "#9ca3af";

  const font =
    "ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, Roboto, Helvetica, Arial";

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
  <defs>
    <linearGradient id="thm-grad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" style="stop-color:#1c2538"/>
      <stop offset="100%" style="stop-color:#0d1117"/>
    </linearGradient>
  </defs>

  <rect width="${W}" height="${H}" rx="12" fill="url(#thm-grad)"/>
  <rect x="0.5" y="0.5" width="${W - 1}" height="${H - 1}" rx="12" fill="none" stroke="#30363d"/>

  <circle cx="50" cy="50" r="28" fill="none" stroke="${accent}" stroke-width="3"/>
  <text x="50" y="56" text-anchor="middle" fill="${accent}" font-size="18" font-weight="bold" font-family="${font}">THM</text>

  <text x="95" y="40" fill="${textLight}" font-size="22" font-weight="bold" font-family="${font}">${data.username}</text>
  <text x="95" y="62" fill="${accent}" font-size="14" font-weight="600" font-family="${font}">Rank ${data.rank}</text>

  <line x1="20" y1="90" x2="${W - 20}" y2="90" stroke="#30363d"/>

  <g transform="translate(40, 115)">
    <text x="0" y="0" text-anchor="middle" fill="${textLight}" font-size="16" font-weight="bold" font-family="${font}">${data.points}</text>
    <text x="0" y="16" text-anchor="middle" fill="${textMuted}" font-size="11" font-family="${font}">points</text>
  </g>

  <g transform="translate(140, 115)">
    <text x="0" y="0" text-anchor="middle" fill="${textLight}" font-size="16" font-weight="bold" font-family="${font}">${data.rooms}</text>
    <text x="0" y="16" text-anchor="middle" fill="${textMuted}" font-size="11" font-family="${font}">rooms</text>
  </g>

  <g transform="translate(240, 115)">
    <text x="0" y="0" text-anchor="middle" fill="${accent}" font-size="16" font-weight="bold" font-family="${font}">${data.streak}</text>
    <text x="0" y="16" text-anchor="middle" fill="${textMuted}" font-size="11" font-family="${font}">streak</text>
  </g>

  <g transform="translate(340, 115)">
    <circle cx="0" cy="-5" r="8" fill="${accent}" opacity="0.2"/>
    <circle cx="0" cy="-5" r="4" fill="${accent}"/>
  </g>
</svg>`;
}

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const userId = url.searchParams.get("id");

    if (!userId) {
      return new Response("Missing 'id' parameter (userPublicId)", { status: 400 });
    }

    const data = await fetchTHMData(userId);
    const svg = renderBadge(data);

    return new Response(svg, {
      headers: {
        "Content-Type": "image/svg+xml; charset=utf-8",
        "Cache-Control": "public, max-age=0, s-maxage=21600, stale-while-revalidate=86400",
      },
    });
  } catch (e: any) {
    const msg = (e?.message || "Unknown error").toString();
    return new Response(`Error: ${msg.slice(0, 800)}`, { status: 500 });
  }
}
