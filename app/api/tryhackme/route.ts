export const runtime = "edge";

interface THMData {
  username: string;
  rank: string;
  points: string;
  streak: string;
  rooms: string;
  avatarBase64: string;
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
  const rank = rankMatch ? `0x${rankMatch[1]}` : "";

  const numbers = [...html.matchAll(/>(\d{4,})</g)].map(m => m[1]);
  const points = numbers[0] ?? "0";

  const streakMatch = html.match(/(\d+)\s*days/i);
  const streak = streakMatch?.[1] ?? "0";

  const smallNumbers = [...html.matchAll(/>(\d{1,2})</g)].map(m => m[1]);
  const rooms = smallNumbers[0] ?? "0";

  const avatarMatch = html.match(/tryhackme-images\.s3\.amazonaws\.com\/user-avatars\/[^"'\s\)]+/);
  const avatarUrl = avatarMatch ? `https://${avatarMatch[0]}` : "";

  let avatarBase64 = "";
  if (avatarUrl) {
    try {
      const avatarRes = await fetch(avatarUrl);
      if (avatarRes.ok) {
        const buffer = await avatarRes.arrayBuffer();
        const bytes = new Uint8Array(buffer);
        let binary = "";
        for (let i = 0; i < bytes.length; i++) {
          binary += String.fromCharCode(bytes[i]);
        }
        avatarBase64 = `data:image/png;base64,${btoa(binary)}`;
      }
    } catch {}
  }

  return { username, rank, points, streak, rooms, avatarBase64 };
}

function renderBadge(data: THMData): string {
  const W = 300;
  const H = 85;

  const bg = "#1c2538";
  const accent = "#a3ea2a";
  const textLight = "#ffffff";
  const textMuted = "#7a8ba3";
  const border = "#2d3f5a";

  const font = "ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, Roboto, Helvetica, Arial";

  const formatPoints = (p: string) => {
    const num = parseInt(p);
    if (num >= 1000000) return (num / 1000000).toFixed(1) + "M";
    if (num >= 1000) return Math.floor(num / 1000) + "K";
    return p;
  };

  const avatarSection = data.avatarBase64
    ? `<defs>
        <clipPath id="avatar-clip"><circle cx="42" cy="42" r="25"/></clipPath>
      </defs>
      <circle cx="42" cy="42" r="27" fill="none" stroke="${accent}" stroke-width="2"/>
      <image href="${data.avatarBase64}" x="17" y="17" width="50" height="50" clip-path="url(#avatar-clip)" preserveAspectRatio="xMidYMid slice"/>`
    : `<circle cx="42" cy="42" r="25" fill="${border}"/>`;

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
  <rect width="${W}" height="${H}" rx="8" fill="${bg}"/>
  <rect x="0.5" y="0.5" width="${W - 1}" height="${H - 1}" rx="8" fill="none" stroke="${border}"/>

  ${avatarSection}

  <text x="78" y="30" fill="${textLight}" font-size="16" font-weight="700" font-family="${font}">${data.username}</text>
  <text x="78" y="30" fill="${textLight}" font-size="16" font-weight="700" font-family="${font}">
    <tspan>${data.username}</tspan>
    <tspan dx="5" fill="#f0c020" font-size="12">⚡</tspan>
    <tspan dx="3" fill="${textMuted}" font-size="11">[${data.rank}]</tspan>
  </text>

  <text x="78" y="50" fill="${accent}" font-size="12" font-family="${font}">${formatPoints(data.points)} pts</text>
  <text x="155" y="50" fill="${textMuted}" font-size="12" font-family="${font}">${data.streak}d streak</text>

  <text x="78" y="70" fill="${textMuted}" font-size="11" font-family="${font}">tryhackme.com</text>

  <g transform="translate(${W - 45}, 20)">
    <rect width="35" height="45" rx="4" fill="${border}" opacity="0.5"/>
    <text x="17.5" y="16" text-anchor="middle" fill="${textMuted}" font-size="9" font-weight="600" font-family="${font}">TRY</text>
    <text x="17.5" y="28" text-anchor="middle" fill="${textMuted}" font-size="9" font-weight="600" font-family="${font}">HACK</text>
    <text x="17.5" y="40" text-anchor="middle" fill="${accent}" font-size="9" font-weight="600" font-family="${font}">ME</text>
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
