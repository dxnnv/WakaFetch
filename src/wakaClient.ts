import type { ApiTimeframe, NormalizedStatBundle } from "./types.js";

const BASE = process.env.WAKATIME_BASE_URL ?? "https://api.wakatime.com/api/v1";
const USER = process.env.WAKATIME_USERNAME ?? "current";
const API_KEY = process.env.WAKATIME_API_KEY || "";

function getAuthHeaders() {
  if (!API_KEY) return null;
  return { Authorization: `Basic ${Buffer.from(API_KEY + ":").toString("base64")}` as const };
}

const auth = getAuthHeaders();

const UA = `WakaFetch/${process.env.npm_package_version ?? "dev"} (+https://github.com/dxnnv/WakaFetch)`;

async function fetchJSON<T>(url: string, { timeout = 10_000, retries = 2 }: { timeout?: number; retries?: number } = {}) {
  for (let attempt = 0; attempt <= retries; attempt++) {
    const controller = new AbortController();
    const t = setTimeout(() => controller.abort(), timeout);
    try {
      const res = await fetch(url, {
        headers: { ...(auth ?? {}), "User-Agent": UA },
        signal: controller.signal,
      });
      if (res.status === 429 || res.status >= 500) {
        const retryAfter = Number(res.headers.get("retry-after") || 0);
        const waitMs = retryAfter > 0 ? retryAfter * 1000 : Math.min(2000, 250 * 2 ** attempt);
        await new Promise((r) => setTimeout(r, waitMs));
        continue;
      }
      const body = (await res.json().catch(() => ({}))) as T;
      return { status: res.status, body };
    } finally {
      clearTimeout(t);
    }
  }
  throw new Error("WakaTime request failed after retries");
}

function ymd(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function startOfISOWeek(d: Date): Date {
  const date = new Date(d);
  const day = (date.getDay() + 6) % 7; // 0 = Monday
  date.setDate(date.getDate() - day);
  date.setHours(0, 0, 0, 0);
  return date;
}

function addDays(d: Date, n: number): Date {
  const x = new Date(d);
  x.setDate(x.getDate() + n);
  return x;
}

function formatSeconds(secs: number): string {
  const h = Math.floor(secs / 3600);
  const m = Math.floor((secs % 3600) / 60);
  return `${h} hrs ${m} mins`;
}

type SummariesResp = {
  data?: Array<{
    grand_total?: { total_seconds?: number; text?: string };
    languages?: Array<{ name: string; total_seconds: number }>;
    projects?: Array<{ name: string; total_seconds: number }>;
    range?: { date?: string };
  }>;
};

export async function fetchStats(tf: ApiTimeframe): Promise<NormalizedStatBundle> {
  if (tf === "all_time") {
    const url = `${BASE}/users/${encodeURIComponent(USER)}/stats/all_time`;
    const { body } = await fetchJSON<any>(url);
    const secs = body?.data?.total_seconds ?? null;
    const avg = body?.data?.daily_average ?? null;
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

  // summaries for date ranges
  const today = new Date();
  let start: Date;
  let end: Date;

  switch (tf) {
    case "today":
      start = new Date(today); start.setHours(0, 0, 0, 0);
      end = new Date(today); end.setHours(23, 59, 59, 999);
      break;
    case "this_week":
      start = startOfISOWeek(today);
      end = addDays(start, 6);
      break;
    case "last_7_days":
      end = new Date(today); end.setHours(23,59,59,999);
      start = addDays(end, -6);
      break;
    case "last_14_days":
      end = new Date(today); end.setHours(23,59,59,999);
      start = addDays(end, -13);
      break;
    case "this_month":
      start = new Date(today.getFullYear(), today.getMonth(), 1);
      end = new Date(today.getFullYear(), today.getMonth() + 1, 0);
      break;
    case "this_year":
      start = new Date(today.getFullYear(), 0, 1);
      end = new Date(today.getFullYear(), 11, 31);
      break;
    default:
      start = new Date(today);
      end = new Date(today);
  }

  const url = new URL(`${BASE}/users/${encodeURIComponent(USER)}/summaries`);
  url.searchParams.set("start", ymd(start));
  url.searchParams.set("end", ymd(end));

  const { body } = await fetchJSON<SummariesResp>(url.toString());
  const days = body.data ?? [];

  const totalSeconds = days.reduce((acc, d) => acc + (d.grand_total?.total_seconds ?? 0), 0);
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

  // Aggregate languages and projects
  const agg = (key: "languages" | "projects") => {
    const map = new Map<string, number>();
    for (const d of days) {
      for (const x of (d[key] ?? [])) {
        map.set(x.name, (map.get(x.name) ?? 0) + x.total_seconds);
      }
    }
    const total = Array.from(map.values()).reduce((a, b) => a + b, 0) || 1;
    return Array.from(map, ([name, seconds]) => ({
      name,
      seconds,
      percent: (seconds / total) * 100,
    })).sort((a, b) => b.seconds - a.seconds);
  };

  const languagesAgg = agg("languages");
  const projectsAgg = agg("projects");

  return {
    timeframe: tf,
    fetchedAt: new Date().toISOString(),
    source: {},
    daily_average: { seconds: dailyAvg, text: dailyAvg != null ? formatSeconds(dailyAvg) : null },
    total_time: { seconds: totalSeconds, text: totalSeconds ? formatSeconds(totalSeconds) : null },
    top_languages: languagesAgg.slice(0, 5),
    most_active_day: { date: madDate, seconds: madSecs, text: madSecs != null ? formatSeconds(madSecs) : null },
    top_projects: projectsAgg.slice(0, 5),
    languages_used: languagesAgg.map((l) => l.name),
    languages_by_usage: languagesAgg,
  };
}