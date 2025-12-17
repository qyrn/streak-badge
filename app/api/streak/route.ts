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
  // only keep days with explicit dates, ensure sorted asc
  const days = [...daysAsc].sort((a, b) => a.date.localeCompare(b.date));

  const total = days.reduce((s, d) => s + d.contributionCount, 0);

  const firstActive = days.find((d) => d.contributionCount > 0)?.date ?? toUTCDate(new Date());

  // longest streak + range
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

  // current streak + range (today if >0 else yesterday)
  const map = new Map(days.map((d) => [d.date, d.contributionCount]));
  let end = toUTCDate(new Date());
  if ((map.get(end) ?? 0) === 0) end = toUTCDate(addDays(new Date(), -1));

  let current = 0;
  let start = end;

  for (let dt = new Date(end + "T00:00:00Z"); ; dt = addDays(dt, -1)) {
    const key = toUTCDate(dt);
    const c = map.get(key) ?? 0;
    if (c > 0) {
      current++;
      start = key;
    } else break;
    // stop if we go before our dataset
    if (key === days[0]?.date) break;
  }

  return {
    total,
    firstActive,
    current,
    currentStart: start,
    currentEnd: end,
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
  // tuned to match the screenshot style
  const W = 900;
  const H = 220;
  const pad = 36;
  const colW = W / 3;

  const orange = "#f59e0b";
  const textDark = "#111827";
  const textMuted = "#6b7280";
  const border = "#e5e7eb";
  const bg = "#ffffff";

const innerW = colW - pad * 2; // largeur utile dans une colonne
const leftCX = colW / 2;
const midCX = colW + colW / 2;
const rightCX = colW * 2 + colW / 2;


  const totalRange = `${fmt(stats.firstActive)} - Present`;
  const curRange = `${fmt(stats.currentStart)} - ${fmt(stats.currentEnd)}`;
  const maxRange =
    stats.maxStart && stats.maxEnd ? `${fmt(stats.maxStart)} - ${fmt(stats.maxEnd)}` : "";

  // simple flame path (works reliably on GitHub)
  const flamePath =
    "M10 2c1.8 3.1 1.4 4.9-.7 7.3C7.8 11 7 12.2 7 13.8 7 16.1 8.9 18 11.2 18c2.6 0 4.8-2.2 4.8-4.8 0-3-2.3-4.8-3.7-7.3-.4 1.5-1.3 2.4-2.3 3.2.3-1.9-.1-3.4 0-6.9z";

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
  <rect x="0.5" y="0.5" width="${W - 1}" height="${H - 1}" rx="14" fill="${bg}" stroke="${border}"/>

  <!-- vertical dividers -->
  <line x1="${colW}" y1="22" x2="${colW}" y2="${H - 22}" stroke="${border}" />
  <line x1="${colW * 2}" y1="22" x2="${colW * 2}" y2="${H - 22}" stroke="${border}" />

  <!-- LEFT: Total Contributions -->
  <text x="${leftX}" y="82" fill="${textDark}" font-size="54" font-weight="700"
        font-family="system-ui, -apple-system, Segoe UI, Roboto">${stats.total.toLocaleString("en-US")}</text>
  <text x="${leftX}" y="122" fill="${textDark}" font-size="20"
        font-family="system-ui, -apple-system, Segoe UI, Roboto">Total Contributions</text>
  <text x="${leftX}" y="156" fill="${textMuted}" font-size="16"
        font-family="system-ui, -apple-system, Segoe UI, Roboto">${totalRange}</text>

  <!-- MIDDLE: Current Streak -->
  <g transform="translate(${colW + colW / 2}, 78)">
    <circle cx="0" cy="0" r="54" fill="none" stroke="${orange}" stroke-width="10" />
    <text x="0" y="12" text-anchor="middle" fill="${textDark}" font-size="44" font-weight="800"
          font-family="system-ui, -apple-system, Segoe UI, Roboto">${stats.current}</text>

    <!-- flame icon -->
    <g transform="translate(-11,-74)">
      <path d="${flamePath}" fill="${orange}" />
    </g>
  </g>

  <text x="${colW + colW / 2}" y="165" text-anchor="middle" fill="${orange}" font-size="20" font-weight="700"
        font-family="system-ui, -apple-system, Segoe UI, Roboto">Current Streak</text>
  <text x="${colW + colW / 2}" y="192" text-anchor="middle" fill="${textMuted}" font-size="16"
        font-family="system-ui, -apple-system, Segoe UI, Roboto">${curRange}</text>

  <!-- RIGHT: Longest Streak -->
  <text x="${rightX}" y="82" fill="${textDark}" font-size="54" font-weight="700"
        font-family="system-ui, -apple-system, Segoe UI, Roboto">${stats.max.toLocaleString("en-US")}</text>
  <text x="${rightX}" y="122" fill="${textDark}" font-size="20"
        font-family="system-ui, -apple-system, Segoe UI, Roboto">Longest Streak</text>
  <text x="${rightX}" y="156" fill="${textMuted}" font-size="16"
        font-family="system-ui, -apple-system, Segoe UI, Roboto">${maxRange}</text>
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
  const url = new URL(req.url);
  const user = url.searchParams.get("user") || "vestal2k";
  const token = process.env.GITHUB_TOKEN;

  if (!token) return new Response("Missing GITHUB_TOKEN", { status: 500 });

  // Optional: lock to your username so others can't use your token
  // if (user !== "vestal2k") return new Response("Forbidden", { status: 403 });

  // 1) get years that have contributions
  const yearsRes = await ghGraphQL<any>(
    token,
    ``
      + `query($login:String!){`
      + `  user(login:$login){`
      + `    contributionsCollection{ contributionYears }`
      + `  }`
      + `}`,
    { login: user },
  );

  const years: number[] =
    yearsRes?.data?.user?.contributionsCollection?.contributionYears ?? [];

  if (!years.length) {
    return new Response("No contribution years found", { status: 404 });
  }

  // 2) fetch each year's calendar and merge days
  const allDays: Day[] = [];
  for (const y of years) {
    const from = new Date(Date.UTC(y, 0, 1, 0, 0, 0));
    const to = new Date(Date.UTC(y + 1, 0, 1, 0, 0, 0)); // exclusive

    const yrRes = await ghGraphQL<any>(
      token,
      `
      query($login:String!, $from:DateTime!, $to:DateTime!) {
        user(login:$login) {
          contributionsCollection(from:$from, to:$to) {
            contributionCalendar {
              weeks { contributionDays { date contributionCount } }
            }
          }
        }
      }`,
      { login: user, from: from.toISOString(), to: to.toISOString() },
    );

    const weeks = yrRes?.data?.user?.contributionsCollection?.contributionCalendar?.weeks ?? [];
    const days: Day[] = weeks.flatMap((w: any) => w.contributionDays);
    allDays.push(...days);
  }

  const stats = computeAllStats(allDays);

  return new Response(renderCard(stats), {
    headers: {
      "Content-Type": "image/svg+xml; charset=utf-8",
      // cache more agressively, because multi-year fetching = heavier
      "Cache-Control": "public, s-maxage=21600, stale-while-revalidate=86400",
    },
  });
}
