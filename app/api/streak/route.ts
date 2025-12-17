export const runtime = "edge";

type Day = { date: string; contributionCount: number };

const toUTCDate = (d: Date) => d.toISOString().slice(0, 10);

const addDays = (d: Date, days: number) => {
  const x = new Date(d);
  x.setUTCDate(x.getUTCDate() + days);
  return x;
};

const fmt = (isoDate: string) =>
  new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric" }).format(
    new Date(isoDate + "T00:00:00Z"),
  );

function computeAllStats(daysAsc: Day[]) {
  const days = [...daysAsc].sort((a, b) => a.date.localeCompare(b.date));
  const total = days.reduce((s, d) => s + d.contributionCount, 0);
  const firstActive = days.find((d) => d.contributionCount > 0)?.date ?? toUTCDate(new Date());

  let max = 0;
  let run = 0;
  let runStart = "";
  let bestStart = "";
  let bestEnd = "";

  for (const d of days) {
    if (d.contributionCount > 0) {
      if (run === 0) runStart = d.date;
      run++;
      if (run > max) {
        max = run;
        bestStart = runStart;
        bestEnd = d.date;
      }
    } else {
      run = 0;
      runStart = "";
    }
  }

  const map = new Map(days.map((d) => [d.date, d.contributionCount] as const));
  let currentEnd = toUTCDate(new Date());
  if ((map.get(currentEnd) ?? 0) === 0) currentEnd = toUTCDate(addDays(new Date(), -1));

  let current = 0;
  let currentStart = currentEnd;

  for (let dt = new Date(currentEnd + "T00:00:00Z"); ; dt = addDays(dt, -1)) {
    const key = toUTCDate(dt);
    const c = map.get(key) ?? 0;
    if (c > 0) {
      current++;
      currentStart = key;
    } else {
      break;
    }
    if (key === days[0]?.date) break;
  }

  return {
    total,
    firstActive,
    current,
    currentStart,
    currentEnd,
    max,
    maxStart: bestStart,
    maxEnd: bestEnd,
  };
}

function renderCard(stats: {
  total: number;
  firstActive: string;
  current: number;
  currentStart: string;
  currentEnd: string;
  max: number;
  maxStart: string;
  maxEnd: string;
}) {
  const W = 960;
  const H = 220;
  const colW = W / 3;

  const leftCX = colW / 2;
  const midCX = colW + colW / 2;
  const rightCX = colW * 2 + colW / 2;

  const orange = "#f59e0b";
  const textDark = "#111827";
  const textMuted = "#6b7280";
  const border = "#e5e7eb";
  const bg = "#ffffff";

  const font =
    'ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, "Apple Color Emoji", "Segoe UI Emoji"';

  const totalRange = `${fmt(stats.firstActive)} - Present`;
  const curRange = `${fmt(stats.currentStart)} - ${fmt(stats.currentEnd)}`;
  const maxRange =
    stats.maxStart && stats.maxEnd ? `${fmt(stats.maxStart)} - ${fmt(stats.maxEnd)}` : "";

  const flamePath =
    "M10 2c1.8 3.1 1.4 4.9-.7 7.3C7.8 11 7 12.2 7 13.8 7 16.1 8.9 18 11.2 18c2.6 0 4.8-2.2 4.8-4.8 0-3-2.3-4.8-3.7-7.3-.4 1.5-1.3 2.4-2.3 3.2.3-1.9-.1-3.4 0-6.9z";

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
  <rect x="0.5" y="0.5" width="${W - 1}" height="${H - 1}" rx="14" fill="${bg}" stroke="${border}"/>
  <line x1="${colW}" y1="22" x2="${colW}" y2="${H - 22}" stroke="${border}" />
  <line x1="${colW * 2}" y1="22" x2="${colW * 2}" y2="${H - 22}" stroke="${border}" />

  <text x="${leftCX}" y="82" text-anchor="middle"
        fill="${textDark}" font-size="54" font-weight="800"
        font-family="${font}">${stats.total.toLocaleString("en-US")}</text>
  <text x="${leftCX}" y="122" text-anchor="middle"
        fill="${textDark}" font-size="20"
        font-family="${font}">Total Contributions</text>
  <text x="${leftCX}" y="156" text-anchor="middle"
        fill="${textMuted}" font-size="15"
        font-family="${font}">${totalRange}</text>

  <g transform="translate(${midCX}, 78)">
    <circle cx="0" cy="0" r="54" fill="none" stroke="${orange}" stroke-width="10" />
    <text x="0" y="12" text-anchor="middle"
          fill="${textDark}" font-size="44" font-weight="900"
          font-family="${font}">${stats.current}</text>
    <g transform="translate(-11,-74)">
      <path d="${flamePath}" fill="${orange}" />
    </g>
  </g>

  <text x="${midCX}" y="165" text-anchor="middle"
        fill="${orange}" font-size="20" font-weight="800"
        font-family="${font}">Current Streak</text>
  <text x="${midCX}" y="192" text-anchor="middle"
        fill="${textMuted}" font-size="15"
        font-family="${font}">${curRange}</text>

  <text x="${rightCX}" y="82" text-anchor="middle"
        fill="${textDark}" font-size="54" font-weight="800"
        font-family="${font}">${stats.max.toLocaleString("en-US")}</text>
  <text x="${rightCX}" y="122" text-anchor="middle"
        fill="${textDark}" font-size="20"
        font-family="${font}">Longest Streak</text>
  <text x="${rightCX}" y="156" text-anchor="middle"
        fill="${textMuted}" font-size="15"
        font-family="${font}">${maxRange}</text>
</svg>`;
}

async function ghGraphQL<T>(token: string, query: string, variables: any): Promise<T> {
  const r = await fetch("https://api.github.com/graphql", {
    method: "POST",
    headers: { Authorization: `bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({ query, variables }),
  });
  if (!r.ok) throw new Error(await r.text());
  return (await r.json()) as T;
}

export async function GET(req: Request) {
  const token = process.env.GITHUB_TOKEN;
  if (!token) return new Response("Missing GITHUB_TOKEN", { status: 500 });

  const allowedUser = process.env.ALLOWED_USER || "vestal2k";
  const cacheSeconds = Number(process.env.CACHE_SECONDS || "21600");

  const url = new URL(req.url);
  const userParam = url.searchParams.get("user");
  const user = userParam || allowedUser;

  if (user !== allowedUser) return new Response("Not found", { status: 404 });

  for (const [k] of url.searchParams) {
    if (k !== "user") return new Response("Bad request", { status: 400 });
  }

  const cache = await caches.open("streak-badge");
  const cacheKeyUrl = `${url.origin}/api/streak?user=${encodeURIComponent(allowedUser)}`;
  const cacheKey = new Request(cacheKeyUrl, { headers: { Accept: "image/svg+xml" } });

  const cached = await cache.match(cacheKey);
  if (cached) return cached;

  const yearsRes = await ghGraphQL<any>(
    token,
    `query($login:String!){user(login:$login){contributionsCollection{contributionYears}}}`,
    { login: user },
  );

  const years: number[] = yearsRes?.data?.user?.contributionsCollection?.contributionYears ?? [];
  if (!years.length) return new Response("No contribution years found", { status: 404 });

  const perYear = await Promise.all(
    years.map(async (y) => {
      const from = new Date(Date.UTC(y, 0, 1, 0, 0, 0));
      const to = new Date(Date.UTC(y + 1, 0, 1, 0, 0, 0));

      const yrRes = await ghGraphQL<any>(
        token,
        `query($login:String!, $from:DateTime!, $to:DateTime!) {
          user(login:$login) {
            contributionsCollection(from:$from, to:$to) {
              contributionCalendar { weeks { contributionDays { date contributionCount } } }
            }
          }
        }`,
        { login: user, from: from.toISOString(), to: to.toISOString() },
      );

      const weeks = yrRes?.data?.user?.contributionsCollection?.contributionCalendar?.weeks ?? [];
      const days: Day[] = weeks.flatMap((w: any) => w.contributionDays);
      return days;
    }),
  );

  const stats = computeAllStats(perYear.flat());
  const body = renderCard(stats);

  const res = new Response(body, {
    headers: {
      "Content-Type": "image/svg+xml; charset=utf-8",
      "Cache-Control": `public, s-maxage=${cacheSeconds}, stale-while-revalidate=86400`,
    },
  });

  await cache.put(cacheKey, res.clone());
  return res;
}
