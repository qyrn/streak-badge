// pages/api/streak.ts
import type { NextApiRequest, NextApiResponse } from "next";

type Day = { date: string; contributionCount: number };

const toUTCDate = (d: Date) => d.toISOString().slice(0, 10);
const addDays = (d: Date, days: number) => {
  const x = new Date(d);
  x.setUTCDate(x.getUTCDate() + days);
  return x;
};

function computeStreaks(days: Day[]) {
  const map = new Map(days.map(d => [d.date, d.contributionCount]));
  const allDates: string[] = [];
  const start = new Date(days[0]?.date ?? toUTCDate(addDays(new Date(), -370)));
  const end = new Date(toUTCDate(new Date()));
  for (let dt = new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth(), start.getUTCDate()));
       dt <= end;
       dt = addDays(dt, 1)) {
    allDates.push(toUTCDate(dt));
  }

  // current streak: today if >0 else yesterday, then walk back
  let cursor = toUTCDate(new Date());
  if ((map.get(cursor) ?? 0) === 0) cursor = toUTCDate(addDays(new Date(), -1));

  let current = 0;
  for (let dt = new Date(cursor); ; dt = addDays(dt, -1)) {
    const key = toUTCDate(dt);
    const c = map.get(key) ?? 0;
    if (c > 0) current++;
    else break;
    // stop if we go earlier than our range
    if (key === allDates[0]) break;
  }

  // max streak over range
  let max = 0, run = 0;
  for (const d of allDates) {
    if ((map.get(d) ?? 0) > 0) {
      run++;
      if (run > max) max = run;
    } else {
      run = 0;
    }
  }

  const total = days.reduce((s, d) => s + d.contributionCount, 0);
  return { current, max, total };
}

function svg({ user, current, max, total }: { user: string; current: number; max: number; total: number }) {
  const w = 520, h = 120;
  const title = `${user} — Streak`;
  const line1 = `Current: ${current} day(s)`;
  const line2 = `Max: ${max} day(s) • Total (range): ${total}`;

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#0b0b0f"/>
      <stop offset="100%" stop-color="#161622"/>
    </linearGradient>
  </defs>
  <rect x="0.5" y="0.5" width="${w-1}" height="${h-1}" rx="14" fill="url(#bg)" stroke="#2a2a3a"/>
  <text x="20" y="38" fill="#ffffff" font-size="20" font-family="ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto">${title}</text>
  <text x="20" y="70" fill="#cfcfe6" font-size="16" font-family="ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto">${line1}</text>
  <text x="20" y="96" fill="#9aa0b4" font-size="14" font-family="ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto">${line2}</text>
</svg>`;
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const user = (req.query.user as string) || "vestal2k";
  const token = process.env.GITHUB_TOKEN;

  if (!token) {
    res.status(500).send("Missing GITHUB_TOKEN");
    return;
  }

  const to = new Date();
  const from = addDays(to, -370);

  const query = `
    query($login:String!, $from:DateTime!, $to:DateTime!) {
      user(login:$login) {
        contributionsCollection(from:$from, to:$to) {
          contributionCalendar {
            weeks { contributionDays { date contributionCount } }
          }
        }
      }
    }
  `;

  const gh = await fetch("https://api.github.com/graphql", {
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

  if (!gh.ok) {
    res.status(gh.status).send(`GitHub API error: ${await gh.text()}`);
    return;
  }

  const data = await gh.json();
  const weeks = data?.data?.user?.contributionsCollection?.contributionCalendar?.weeks ?? [];
  const days: Day[] = weeks.flatMap((w: any) => w.contributionDays);

  const { current, max, total } = computeStreaks(days);

  res.setHeader("Content-Type", "image/svg+xml; charset=utf-8");
  // cache CDN 1h (limite les hits API)
  res.setHeader("Cache-Control", "public, s-maxage=3600, stale-while-revalidate=86400");
  res.status(200).send(svg({ user, current, max, total }));
}
