export const runtime = "edge";

interface FilmData {
  title: string;
  year: string;
  rating: number;
  posterUrl: string;
  watchedDate: string;
  liked: boolean;
}

async function fetchLatestFilm(username: string): Promise<FilmData> {
  const res = await fetch(`https://letterboxd.com/${username}/rss/`, {
    headers: {
      "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
    },
  });

  if (!res.ok) throw new Error(`Letterboxd RSS error: ${res.status}`);

  const xml = await res.text();

  const titleMatch = xml.match(/<letterboxd:filmTitle>([^<]+)<\/letterboxd:filmTitle>/);
  const title = titleMatch?.[1] ?? "Unknown";

  const yearMatch = xml.match(/<letterboxd:filmYear>([^<]+)<\/letterboxd:filmYear>/);
  const year = yearMatch?.[1] ?? "";

  const ratingMatch = xml.match(/<letterboxd:memberRating>([^<]+)<\/letterboxd:memberRating>/);
  const rating = ratingMatch ? parseFloat(ratingMatch[1]) : 0;

  const posterMatch = xml.match(/<description>[^]*?src="([^"]+)"[^]*?<\/description>/);
  const posterUrl = posterMatch?.[1] ?? "";

  const dateMatch = xml.match(/<letterboxd:watchedDate>([^<]+)<\/letterboxd:watchedDate>/);
  const watchedDate = dateMatch?.[1] ?? "";

  const likedMatch = xml.match(/<letterboxd:memberLike>([^<]+)<\/letterboxd:memberLike>/);
  const liked = likedMatch?.[1] === "Yes";

  return { title, year, rating, posterUrl, watchedDate, liked };
}

function formatDate(dateStr: string): string {
  if (!dateStr) return "";
  const date = new Date(dateStr);
  const now = new Date();
  const diff = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24));
  if (diff === 0) return "today";
  if (diff === 1) return "1d";
  if (diff < 30) return `${diff}d`;
  if (diff < 365) return `${Math.floor(diff / 30)}mo`;
  return `${Math.floor(diff / 365)}y`;
}

function renderStars(rating: number, startX: number, y: number): string {
  const fullStars = Math.floor(rating);
  const halfStar = rating % 1 >= 0.5;
  const starColor = "#00e054";
  const emptyColor = "#456";

  let stars = "";
  const size = 12;
  const gap = 2;

  const starPath = (cx: number, cy: number, fill: string) => {
    const r1 = size / 2;
    const r2 = r1 * 0.4;
    let d = "";
    for (let i = 0; i < 5; i++) {
      const angle1 = (i * 72 - 90) * Math.PI / 180;
      const angle2 = ((i * 72) + 36 - 90) * Math.PI / 180;
      const x1 = cx + r1 * Math.cos(angle1);
      const y1 = cy + r1 * Math.sin(angle1);
      const x2 = cx + r2 * Math.cos(angle2);
      const y2 = cy + r2 * Math.sin(angle2);
      d += (i === 0 ? "M" : "L") + `${x1.toFixed(1)},${y1.toFixed(1)} L${x2.toFixed(1)},${y2.toFixed(1)} `;
    }
    d += "Z";
    return `<path d="${d}" fill="${fill}"/>`;
  };

  for (let i = 0; i < 5; i++) {
    const cx = startX + i * (size + gap) + size / 2;
    const fill = i < fullStars ? starColor : (i === fullStars && halfStar ? starColor : emptyColor);
    stars += starPath(cx, y, fill);
  }

  return stars;
}

function renderHeart(x: number, y: number, filled: boolean): string {
  const color = filled ? "#ff6b6b" : "#456";
  return `<path d="M${x},${y + 3} C${x - 3},${y} ${x - 6},${y + 1} ${x - 6},${y + 4} C${x - 6},${y + 7} ${x},${y + 11} ${x},${y + 11} C${x},${y + 11} ${x + 6},${y + 7} ${x + 6},${y + 4} C${x + 6},${y + 1} ${x + 3},${y} ${x},${y + 3} Z" fill="${color}"/>`;
}

async function fetchPosterBase64(posterUrl: string): Promise<string> {
  if (!posterUrl) return "";
  try {
    const res = await fetch(posterUrl);
    if (!res.ok) return "";
    const buffer = await res.arrayBuffer();
    const bytes = new Uint8Array(buffer);
    let binary = "";
    for (let i = 0; i < bytes.length; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    const base64 = btoa(binary);
    const contentType = res.headers.get("content-type") || "image/jpeg";
    return `data:${contentType};base64,${base64}`;
  } catch {
    return "";
  }
}

async function renderBadge(data: FilmData): Promise<string> {
  const W = 300;
  const H = 85;

  const bg = "#14181c";
  const textLight = "#ffffff";
  const textMuted = "#9ab";
  const border = "#456";

  const font = "ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, Roboto, Helvetica, Arial";

  const posterBase64 = await fetchPosterBase64(data.posterUrl);

  const posterSection = posterBase64
    ? `<defs><clipPath id="poster-clip"><rect x="8" y="8" width="45" height="69" rx="3"/></clipPath></defs>
       <image href="${posterBase64}" x="8" y="8" width="45" height="69" clip-path="url(#poster-clip)" preserveAspectRatio="xMidYMid slice"/>`
    : `<rect x="8" y="8" width="45" height="69" rx="3" fill="${border}"/>`;

  const displayTitle = data.title.length > 18 ? data.title.slice(0, 17) + "…" : data.title;
  const dateAgo = formatDate(data.watchedDate);

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
  <rect width="${W}" height="${H}" rx="8" fill="${bg}"/>
  <rect x="0.5" y="0.5" width="${W - 1}" height="${H - 1}" rx="8" fill="none" stroke="${border}"/>

  ${posterSection}

  <text x="62" y="28" fill="${textLight}" font-size="15" font-weight="600" font-family="${font}">${displayTitle}</text>
  <text x="62" y="44" fill="${textMuted}" font-size="12" font-family="${font}">${data.year}</text>

  ${renderStars(data.rating, 62, 60)}
  ${renderHeart(W - 22, 56, data.liked)}

  <text x="${W - 12}" y="75" text-anchor="end" fill="${textMuted}" font-size="11" font-family="${font}">${dateAgo}</text>
</svg>`;
}

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const username = url.searchParams.get("user");

    if (!username) {
      return new Response("Missing 'user' parameter", { status: 400 });
    }

    const data = await fetchLatestFilm(username);
    const svg = await renderBadge(data);

    return new Response(svg, {
      headers: {
        "Content-Type": "image/svg+xml; charset=utf-8",
        "Cache-Control": "public, max-age=0, s-maxage=3600, stale-while-revalidate=86400",
      },
    });
  } catch (e: any) {
    const msg = (e?.message || "Unknown error").toString();
    return new Response(`Error: ${msg.slice(0, 800)}`, { status: 500 });
  }
}
