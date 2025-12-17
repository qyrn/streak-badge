export const runtime = "edge";

type Day = { date: string; contributionCount: number };

const toUTCDate = (d: Date) => d.toISOString().slice(0, 10);
const addDays = (d: Date, days: number) => {
  const x = new Date(d);
  x.setUTCDate(x.getUTCDate() + days);
  return x;
};

function computeStreak(days: Day[]) {
  const map = new Map(days.map((d) => [d.date, d.contributionCount]));
  const start = new Date(days[0]?.date ?? toUTCDate(addDays(new Date(), -370)));
  const end = new Date(toUTCDate(new Date()));

  const allDates: string[] = [];
  for (
    let dt = new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth(), start.getUTCDate()));
    dt <= end;
    dt = addDays(dt, 1)
  ) {
    allDates.push(toUTCDate(dt));
  }

  // streak courante
  let cursor = toUTCDate(new Date());
  if ((map.get(cursor) ?? 0) === 0) cursor = toUTCDate(addDays(new Date(), -1));

  let current = 0;
  for (let dt = new Date(cursor); ; dt = addDays(dt, -1)) {
    const key = toUTCDate(dt);
    if ((map.get(key) ?? 0) > 0) current++;
    else break;
    if (key === allDates[0]) break;
  }

  // meilleure streak
  let max = 0,
    run = 0;
  for (const d of allDates) {
    if ((map.get(d) ?? 0) > 0) {
      run++;
      if (run > max) max = run;
    } else run = 0;
  }

  const total = days.reduce((s, d) => s + d.contributionCount, 0);
  return { current, max, total };
}

function svg(user: string, current: number, max: number, total: number) {
  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="520" height="120" viewBox="0 0 520 120">
  <rect x="0.5" y="0.5" width="519" height="119" rx="14" fill="#0b0b0f" stroke="#2a2a3a"/>
  <text x="20" y="38" fill="#ffffff" font-size="20" font-family="system-ui, -apple-system, Segoe UI, Roboto">${user} — Streak</text>
  <text x="20" y="70" fill="#cfcfe6" font-size="16" font-family="system-ui, -apple-system, Segoe UI, Roboto">Current: ${current} day(s)</text>
  <text x="20" y="96" fill="#9aa0b4" font-size="14" font-family="system-ui, -apple-system, Segoe UI, Roboto">Max: ${max} day(s) • Total (range): ${total}</text>
</svg>`;
}

export async function GET(req: Request) {
  const url = new URL(req.url);
  const user = url.searchParams.get("user") || "vestal2k";
  const token = process.env.GITHUB_TOKEN;

  if (!token) return new Response("Missing GITHUB_TOKEN", { status: 500 });

  const to = new Date();
  const from = addDays(to, -370);

  const query = `
    query($login:String!, $from:DateTime!, $to:DateTime!) {
      user(login:$login) {
        contributionsCollection(from:$from, to:$to) {
          contributionCalendar {
            weeks { contributionDays { date contributionCount } }
          }
          restrictedContributionsCount
          hasAnyRestrictedContributions
        }
      }
    }
  `;

  const r = await fetch("https://api.github.com/graphql", {
    method: "POST",
    headers: {
      Authorization: `bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      query,
      variables: { login: user, from: from.toISOString(), to: to.toISOString() },
    }),
  });

  if (!r.ok) return new Response(await r.text(), { status: r.status });

  const data = await r.json();
  const weeks = data?.data?.user?.contributionsCollection?.contributionCalendar?.weeks ?? [];
  const days: Day[] = weeks.flatMap((w: any) => w.contributionDays);

  const { current, max, total } = computeStreak(days);

  return new Response(svg(user, current, max, total), {
    headers: {
      "Content-Type": "image/svg+xml; charset=utf-8",
      "Cache-Control": "public, s-maxage=3600, stale-while-revalidate=86400",
    },
  });
}
