export const runtime = "edge";

interface FilmData {
  title: string;
  year: string;
  rating: number;
  posterUrl: string;
  watchedDate: string;
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

  return { title, year, rating, posterUrl, watchedDate };
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

function renderStars(rating: number): string {
  const fullStars = Math.floor(rating);
  const halfStar = rating % 1 >= 0.5;
  const starColor = "#00e054";
  const emptyColor = "#456";

  let stars = "";
  const starWidth = 16;
  const startX = 85;
  const y = 72;

  for (let i = 0; i < 5; i++) {
    const x = startX + i * (starWidth + 3);
    const fill = i < fullStars ? starColor : (i === fullStars && halfStar ? starColor : emptyColor);
    stars += `<polygon points="${x},${y - 7} ${x + 5},${y - 2} ${x + 8},${y - 9} ${x + 11},${y - 2} ${x + 16},${y - 7} ${x + 13},${y + 2} ${x + 14},${y + 9} ${x + 8},${y + 5} ${x + 2},${y + 9} ${x + 3},${y + 2}" fill="${fill}"/>`;
  }

  return stars;
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
  const W = 350;
  const H = 100;

  const bg = "#14181c";
  const accent = "#00e054";
  const textLight = "#ffffff";
  const textMuted = "#9ab";
  const border = "#456";

  const font = "ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, Roboto, Helvetica, Arial";

  const posterBase64 = await fetchPosterBase64(data.posterUrl);

  const posterSection = posterBase64
    ? `<defs><clipPath id="poster-clip"><rect x="10" y="10" width="53" height="80" rx="4"/></clipPath></defs>
       <image href="${posterBase64}" x="10" y="10" width="53" height="80" clip-path="url(#poster-clip)" preserveAspectRatio="xMidYMid slice"/>`
    : `<rect x="10" y="10" width="53" height="80" rx="4" fill="${border}"/>`;

  const displayTitle = data.title.length > 22 ? data.title.slice(0, 21) + "…" : data.title;
  const dateAgo = formatDate(data.watchedDate);

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
  <rect width="${W}" height="${H}" rx="10" fill="${bg}"/>
  <rect x="0.5" y="0.5" width="${W - 1}" height="${H - 1}" rx="10" fill="none" stroke="${border}"/>

  ${posterSection}

  <text x="75" y="35" fill="${textLight}" font-size="18" font-weight="600" font-family="${font}">${displayTitle}</text>
  <text x="75" y="54" fill="${textMuted}" font-size="13" font-family="${font}">${data.year}</text>

  ${renderStars(data.rating)}

  <text x="${W - 15}" y="90" text-anchor="end" fill="${textMuted}" font-size="12" font-family="${font}">${dateAgo}</text>
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
