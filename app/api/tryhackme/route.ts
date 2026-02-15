export const runtime = "edge";

interface THMData {
  username: string;
  rank: string;
  points: string;
  streak: string;
  rooms: string;
  badges: string;
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
  const badges = smallNumbers[1] ?? "0";

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

  return { username, rank, points, streak, rooms, badges, avatarBase64 };
}

function renderBadge(data: THMData): string {
  const W = 320;
  const H = 85;

  const bg = "#212c42";
  const accent = "#88cc14";
  const textLight = "#ffffff";
  const textMuted = "#9ca3af";
  const border = "#2a3a55";

  const font = "ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, Roboto, Helvetica, Arial";

  const avatarSection = data.avatarBase64
    ? `<defs>
        <clipPath id="avatar-clip"><circle cx="42" cy="42" r="28"/></clipPath>
        <linearGradient id="avatar-border" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" style="stop-color:#88cc14"/>
          <stop offset="100%" style="stop-color:#22aa44"/>
        </linearGradient>
      </defs>
      <circle cx="42" cy="42" r="30" fill="url(#avatar-border)"/>
      <image href="${data.avatarBase64}" x="14" y="14" width="56" height="56" clip-path="url(#avatar-clip)" preserveAspectRatio="xMidYMid slice"/>`
    : `<circle cx="42" cy="42" r="28" fill="${border}"/>
       <text x="42" y="48" text-anchor="middle" fill="${accent}" font-size="14" font-weight="bold" font-family="${font}">THM</text>`;

  const formatPoints = (p: string) => {
    const num = parseInt(p);
    if (num >= 1000000) return (num / 1000000).toFixed(1) + "M";
    if (num >= 1000) return (num / 1000).toFixed(0) + "K";
    return p;
  };

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
  <rect width="${W}" height="${H}" rx="8" fill="${bg}"/>
  <rect x="0.5" y="0.5" width="${W - 1}" height="${H - 1}" rx="8" fill="none" stroke="${border}"/>

  ${avatarSection}

  <text x="80" y="28" fill="${textLight}" font-size="15" font-weight="700" font-family="${font}">${data.username}</text>
  <text x="80" y="28" fill="${textLight}" font-size="15" font-weight="700" font-family="${font}">
    ${data.username}
    <tspan fill="#f0c020"> ⚡</tspan>
    <tspan fill="${textMuted}" font-size="12"> [${data.rank}]</tspan>
  </text>

  <g transform="translate(80, 40)">
    <text fill="#c080f0" font-size="11" font-family="${font}">🏆 ${formatPoints(data.points)}</text>
  </g>

  <g transform="translate(145, 40)">
    <text fill="${accent}" font-size="11" font-family="${font}">🔥 ${data.streak} days</text>
  </g>

  <g transform="translate(80, 58)">
    <text fill="#f08080" font-size="11" font-family="${font}">👤 ${data.rooms}</text>
  </g>

  <g transform="translate(120, 58)">
    <text fill="#80a0f0" font-size="11" font-family="${font}">🚪 ${data.badges}</text>
  </g>

  <text x="80" y="75" fill="${textMuted}" font-size="10" font-family="${font}">tryhackme.com</text>

  <g transform="translate(${W - 35}, 12)">
    <text fill="${textMuted}" font-size="8" font-family="${font}" text-anchor="middle">Try</text>
    <text y="9" fill="${textMuted}" font-size="8" font-family="${font}" text-anchor="middle">Hack</text>
    <text y="18" fill="${textMuted}" font-size="8" font-family="${font}" text-anchor="middle">Me</text>
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
