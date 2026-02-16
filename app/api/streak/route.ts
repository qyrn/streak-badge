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
  const W = 300;
  const H = 85;
  const colW = W / 3;

  const accent = "#3fb950";
  const orange = "#f59e0b";
  const textLight = "#e6edf3";
  const textMuted = "#7d8590";
  const border = "#30363d";
  const bg = "#0d1117";

  const font = "ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, Roboto, Helvetica, Arial";

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
  <defs>
    <linearGradient id="streak-ring" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" style="stop-color:${orange}"/>
      <stop offset="100%" style="stop-color:#dc2626"/>
    </linearGradient>
  </defs>

  <rect width="${W}" height="${H}" rx="8" fill="${bg}"/>
  <rect x="0.5" y="0.5" width="${W - 1}" height="${H - 1}" rx="8" fill="none" stroke="${border}"/>

  <line x1="${colW}" y1="15" x2="${colW}" y2="${H - 15}" stroke="${border}" opacity="0.5"/>
  <line x1="${colW * 2}" y1="15" x2="${colW * 2}" y2="${H - 15}" stroke="${border}" opacity="0.5"/>

  <g transform="translate(${colW / 2}, 40)">
    <text x="0" y="0" text-anchor="middle" fill="${textLight}" font-size="24" font-weight="700" font-family="${font}">${stats.total.toLocaleString("en-US")}</text>
    <text x="0" y="18" text-anchor="middle" fill="${textMuted}" font-size="10" font-family="${font}">contributions</text>
  </g>

  <g transform="translate(${colW + colW / 2}, 28)">
    <circle cx="0" cy="0" r="20" fill="none" stroke="url(#streak-ring)" stroke-width="3"/>
    <text x="0" y="6" text-anchor="middle" fill="${textLight}" font-size="16" font-weight="700" font-family="${font}">${stats.current}</text>
  </g>
  <text x="${colW + colW / 2}" y="62" text-anchor="middle" fill="${orange}" font-size="10" font-weight="600" font-family="${font}">current</text>
  <text x="${colW + colW / 2}" y="74" text-anchor="middle" fill="${textMuted}" font-size="9" font-family="${font}">streak</text>

  <g transform="translate(${colW * 2 + colW / 2}, 40)">
    <text x="0" y="0" text-anchor="middle" fill="${textLight}" font-size="24" font-weight="700" font-family="${font}">${stats.max}</text>
    <text x="0" y="18" text-anchor="middle" fill="${textMuted}" font-size="10" font-family="${font}">best streak</text>
  </g>
</svg>`;
}

async function ghGraphQL<T>(token: string, query: string, variables: any): Promise<T> {
  const r = await fetch("https://api.github.com/graphql", {
    method: "POST",
    headers: { Authorization: `bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({ query, variables }),
  });

  const text = await r.text();
  if (!r.ok) throw new Error(`GitHub API ${r.status}: ${text.slice(0, 300)}`);

  const json = JSON.parse(text);
  if (json?.errors?.length) throw new Error(String(json.errors[0]?.message || "GraphQL error"));
  return json as T;
}

function buildMultiYearQuery(years: number[]) {
  const fields = years
    .map((y) => {
      const from = `${y}-01-01T00:00:00Z`;
      const to = `${y + 1}-01-01T00:00:00Z`;
      return `y${y}: contributionsCollection(from: "${from}", to: "${to}") { contributionCalendar { weeks { contributionDays { date contributionCount } } } restrictedContributionsCount }`;
    })
    .join("\n");
  return `query($login:String!){ user(login:$login){ ${fields} } }`;
}

export async function GET(req: Request) {
  try {
    const token = process.env.GITHUB_TOKEN;
    if (!token) return new Response("Missing GITHUB_TOKEN", { status: 500 });

    const allowedUser = process.env.ALLOWED_USER || "qyrn";
    const cacheSeconds = Number(process.env.CACHE_SECONDS || "21600");

    const url = new URL(req.url);

    for (const [k] of url.searchParams) {
      if (k !== "user") return new Response("Bad request", { status: 400 });
    }

    const user = url.searchParams.get("user") || allowedUser;
    if (user !== allowedUser) return new Response("Not found", { status: 404 });

    const yearsRes = await ghGraphQL<any>(
      token,
      `query($login:String!){user(login:$login){contributionsCollection{contributionYears}}}`,
      { login: user },
    );

    const years: number[] = yearsRes?.data?.user?.contributionsCollection?.contributionYears ?? [];
    if (!years.length) return new Response("No contribution years found", { status: 404 });

    const multiQuery = buildMultiYearQuery(years);
    const multiRes = await ghGraphQL<any>(token, multiQuery, { login: user });

    const u = multiRes?.data?.user ?? {};
    const allDays: Day[] = [];
    let privateContribs = 0;

    for (const y of years) {
      const yearData = u?.[`y${y}`];
      const weeks = yearData?.contributionCalendar?.weeks ?? [];
      const days: Day[] = weeks.flatMap((w: any) => w.contributionDays);
      allDays.push(...days);
      privateContribs += yearData?.restrictedContributionsCount ?? 0;
    }

    const stats = computeAllStats(allDays);
    stats.total += privateContribs;
    const body = renderCard(stats);

    return new Response(body, {
      headers: {
        "Content-Type": "image/svg+xml; charset=utf-8",
        "Cache-Control": `public, max-age=0, s-maxage=${cacheSeconds}, stale-while-revalidate=86400`,
      },
    });
  } catch (e: any) {
    const msg = (e?.message || "Unknown error").toString();
    return new Response(`Error: ${msg.slice(0, 800)}`, { status: 500 });
  }
}
