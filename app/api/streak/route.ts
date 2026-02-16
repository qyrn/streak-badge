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

  const accent = "#58a6ff";
  const orange = "#f59e0b";
  const textLight = "#e6edf3";
  const textMuted = "#7d8590";
  const border = "#30363d";
  const bg = "#0d1117";

  const font = "ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, Roboto, Helvetica, Arial";

  const githubLogo = `<path fill="${textMuted}" d="M12 2C6.477 2 2 6.477 2 12c0 4.42 2.865 8.166 6.839 9.489.5.092.682-.217.682-.482 0-.237-.008-.866-.013-1.7-2.782.604-3.369-1.341-3.369-1.341-.454-1.155-1.11-1.462-1.11-1.462-.908-.62.069-.608.069-.608 1.003.07 1.531 1.03 1.531 1.03.892 1.529 2.341 1.087 2.91.831.092-.646.35-1.086.636-1.336-2.22-.253-4.555-1.11-4.555-4.943 0-1.091.39-1.984 1.029-2.683-.103-.253-.446-1.27.098-2.647 0 0 .84-.269 2.75 1.025A9.578 9.578 0 0112 6.836c.85.004 1.705.114 2.504.336 1.909-1.294 2.747-1.025 2.747-1.025.546 1.377.203 2.394.1 2.647.64.699 1.028 1.592 1.028 2.683 0 3.842-2.339 4.687-4.566 4.935.359.309.678.919.678 1.852 0 1.336-.012 2.415-.012 2.743 0 .267.18.578.688.48C19.138 20.163 22 16.418 22 12c0-5.523-4.477-10-10-10z"/>`;

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
  <defs>
    <linearGradient id="streak-ring" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" style="stop-color:${orange}"/>
      <stop offset="100%" style="stop-color:#ea580c"/>
    </linearGradient>
  </defs>

  <rect width="${W}" height="${H}" rx="8" fill="${bg}"/>
  <rect x="0.5" y="0.5" width="${W - 1}" height="${H - 1}" rx="8" fill="none" stroke="${border}"/>

  <g transform="translate(42, 42)">
    <circle cx="0" cy="0" r="26" fill="none" stroke="url(#streak-ring)" stroke-width="4"/>
    <text x="0" y="7" text-anchor="middle" fill="${textLight}" font-size="20" font-weight="700" font-family="${font}">${stats.current}</text>
    <text x="0" y="18" text-anchor="middle" fill="${textMuted}" font-size="8" font-family="${font}">days</text>
  </g>

  <g transform="translate(80, 18)">
    <g transform="scale(0.7)">${githubLogo}</g>
    <text x="22" y="12" fill="${textLight}" font-size="14" font-weight="600" font-family="${font}">GitHub Streak</text>
  </g>

  <text x="80" y="50" fill="${accent}" font-size="11" font-family="${font}">${stats.total.toLocaleString("en-US")} contributions</text>
  <text x="80" y="68" fill="${textMuted}" font-size="11" font-family="${font}">Best: ${stats.max} days</text>
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
      return `y${y}: contributionsCollection(from: "${from}", to: "${to}") { contributionCalendar { weeks { contributionDays { date contributionCount } } } }`;
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

    for (const y of years) {
      const weeks = u?.[`y${y}`]?.contributionCalendar?.weeks ?? [];
      const days: Day[] = weeks.flatMap((w: any) => w.contributionDays);
      allDays.push(...days);
    }

    const stats = computeAllStats(allDays);
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
