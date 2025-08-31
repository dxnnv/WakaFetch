import type { ApiTimeframe, NormalizedStatBundle } from "../types.js";
import {
  toFormattedTime,
  toPercent,
  timeframeLabel,
  toLocalDateTime,
  toShortDate,
} from "../utils/formatUtil.js";

const MIN_LANG_SECONDS = Number(process.env.MIN_LANG_SECONDS ?? 60);
const REWEIGHT_FILTERED_PERCENTS = process.env.REWEIGHT_FILTERED_PERCENTS === "1";

type LangAgg = { name: string; seconds: number; percent: number };
function filterLanguages(items: LangAgg[]): LangAgg[] {
  const filtered = (items ?? []).filter((x) => (x?.seconds ?? 0) >= MIN_LANG_SECONDS);
  if (!REWEIGHT_FILTERED_PERCENTS) return filtered;

  const total = filtered.reduce((a, b) => a + (b.seconds ?? 0), 0) || 1;
  return filtered.map((x) => ({ ...x, percent: (x.seconds / total) * 100 }));
}

export interface FormattedStatBundle {
  timeframe: string;
  fetchedAt: string | null;
  daily_average: string | null;
  total_time: string | null;
  top_languages: Array<{ name: string; time: string; percent: string }>;
  most_active_day: { date: string | null; time: string | null };
  top_projects: Array<{ name: string; time: string; percent: string }>;
  languages_used: string[];
  languages_by_usage: Array<{ name: string; time: string; percent: string }>;
}

export function formatBundlePretty(b: NormalizedStatBundle): FormattedStatBundle {
  const topLangs = filterLanguages(b.top_languages).map((l) => ({
    name: l.name,
    time: toFormattedTime(l.seconds)!,
    percent: toPercent(l.percent)!,
  }));

  const langsByUsage = filterLanguages(b.languages_by_usage).map((l) => ({
    name: l.name,
    time: toFormattedTime(l.seconds)!,
    percent: toPercent(l.percent)!,
  }));

  const projects = filterLanguages(b.top_projects as any).map((p: any) => ({
    name: p.name,
    time: toFormattedTime(p.seconds)!,
    percent: toPercent(p.percent)!,
  }));

  return {
    timeframe: timeframeLabel(b.timeframe),
    fetchedAt: toLocalDateTime(b.fetchedAt),
    daily_average: toFormattedTime(b.daily_average.seconds),
    total_time: toFormattedTime(b.total_time.seconds),
    top_languages: topLangs,
    most_active_day: {
      date: toShortDate(b.most_active_day.date),
      time: toFormattedTime(b.most_active_day.seconds),
    },
    top_projects: projects,
    languages_used: b.languages_used ?? [],
    languages_by_usage: langsByUsage,
  };
}

export function formatMapPretty(m: Record<ApiTimeframe, NormalizedStatBundle | null>,): Record<ApiTimeframe, FormattedStatBundle | null> {
  const out: Partial<Record<ApiTimeframe, FormattedStatBundle | null>> = {};
  for (const [k, v] of Object.entries(m) as [ApiTimeframe, NormalizedStatBundle | null][]) {
    out[k] = v ? formatBundlePretty(v) : null;
  }
  return out as Record<ApiTimeframe, FormattedStatBundle | null>;
}