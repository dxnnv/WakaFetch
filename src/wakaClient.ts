import type { ApiTimeframe, NormalizedStatBundle } from "./types.js";

const BASE = process.env.WAKATIME_BASE_URL ?? "https://api.wakatime.com/api/v1";
const USER = process.env.WAKATIME_USERNAME ?? "current";
const API_KEY = process.env.WAKATIME_API_KEY || "";

if (!API_KEY) throw new Error("WAKATIME_API_KEY missing");

const authHeaders = { Authorization: `Basic ${Buffer.from(API_KEY).toString("base64")}` } as const;

type SummariesResp = { data?: Array<{
  grand_total?: { total_seconds?: number; text?: string };
  languages?: Array<{ name: string; total_seconds: number }>;
  projects?: Array<{ name: string; total_seconds: number }>;
  range?: { date?: string };
}> };

const UA = `WakaFetch/${process.env.npm_package_version ?? "dev"} (+https://github.com/dxnnv/WakaFetch)`;

async function fetchJSON<T>(url: string, { timeout = 10_000, retries = 2 }: { timeout?: number; retries?: number } = {}) {
  for (let attempt = 0; attempt <= retries; attempt++) {
    const controller = new AbortController();
    const t = setTimeout(() => controller.abort(), timeout);
    try {
      const res = await fetch(url, {
        headers: { ...authHeaders, "User-Agent": UA },
        signal: controller.signal,
      });
      if (res.status === 429 || res.status >= 500) {
        const retryAfter = Number(res.headers.get("retry-after") || 0);
        const waitMs = retryAfter > 0 ? retryAfter * 1000 : Math.min(2000, 250 * 2 ** attempt);
        await new Promise(r => setTimeout(r, waitMs));
        continue;
      }
      const body = await res.json().catch(() => ({}));
      return { status: res.status, body: body as T };
    } finally {
      clearTimeout(t);
    }
  }
  throw new Error("WakaTime request failed after retries");
}

async function fetchViaSummaries(rangeLabel: string, tf: ApiTimeframe): Promise<NormalizedStatBundle> {
  const url = new URL(`${BASE}/users/${USER}/summaries`);
  url.searchParams.set("range", rangeLabel);
  const { body } = await fetchJSON<SummariesResp>(url.toString());
  const days = body.data ?? [];

  const totalSeconds = days.reduce((acc, d) => acc + (d.grand_total?.total_seconds ?? 0), 0);
  const totalText = totalSeconds ? formatSeconds(totalSeconds) : null;

  const activeDays = days.filter(d => (d.grand_total?.total_seconds ?? 0) > 0).length || days.length || 1;
  const dayCount = days.length || 1;
  const dailyAvg = Math.round(totalSeconds / dayCount);

  // Most active day
  let madDate: string | null = null, madSecs: number | null = null;
  for (const d of days) {
    const secs = d.grand_total?.total_seconds ?? 0;
    if (madSecs === null || secs > madSecs) {
      madSecs = secs;
      madDate = d.range?.date ?? null;
    }
  }

  const agg = (items: ("languages" | "projects")) => {
    const map = new Map<string, number>();
    for (const d of days) for (const x of (d[items] ?? [])) {
      map.set(x.name, (map.get(x.name) ?? 0) + x.total_seconds);
    }
    const total = Array.from(map.values()).reduce((a, b) => a + b, 0) || 1;
    return Array.from(map, ([name, seconds]) => ({ name, seconds, percent: (seconds / total) * 100 }))
      .sort((a, b) => b.seconds - a.seconds);
  };

  const langs = agg("languages");
  const projs = agg("projects");

  return {
    timeframe: tf,
    fetchedAt: new Date().toISOString(),
    source: {},
    daily_average: { seconds: dailyAvg, text: formatSeconds(dailyAvg) },
    total_time: { seconds: totalSeconds, text: totalText },
    top_languages: langs.slice(0, 5),
    most_active_day: { date: madDate, seconds: madSecs, text: madSecs != null ? formatSeconds(madSecs) : null },
    top_projects: projs.slice(0, 5),
    languages_used: langs.map(l => l.name),
    languages_by_usage: langs,
  };
}

function formatSeconds(sec: number): string {
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  return `${h} hrs ${m} mins`;
}

const SUMMARY_LABEL: Partial<Record<ApiTimeframe, string>> = {
  today: "Today",
  this_week: "This Week",
  last_7_days: "Last 7 Days",
  last_14_days: "Last 14 Days",
  this_month: "This Month",
  this_year: "This Year",
};

export async function fetchStats(timeframe: ApiTimeframe): Promise<NormalizedStatBundle> {
  const label = SUMMARY_LABEL[timeframe];
  if (label) return fetchViaSummaries(label, timeframe);

  const { body } = await fetchJSON<{ data?: { total_seconds?: number; daily_average?: number; text?: string } }>(
    `${BASE}/users/${USER}/all_time_since_today`
  );
  const secs = body.data?.total_seconds ?? null;
  const avg = body.data?.daily_average ?? null;

  return {
    timeframe: "all_time",
    fetchedAt: new Date().toISOString(),
    source: {},
    daily_average: { seconds: avg, text: avg != null ? formatSeconds(avg) : null },
    total_time: { seconds: secs, text: secs != null ? formatSeconds(secs) : null },
    top_languages: [],
    most_active_day: { date: null, seconds: null, text: null },
    top_projects: [],
    languages_used: [],
    languages_by_usage: [],
  };
}