import type { ApiTimeframe, NormalizedStatBundle } from "../types.js";
import { toFormattedTime, toPercent, timeframeLabel, toLocalDateTime, toShortDate } from "../utils/formatUtil.js";

const MIN_LANG_SECONDS = Number(process.env.MIN_LANG_SECONDS ?? 60);
const REWEIGHT_FILTERED_PERCENTS = process.env.REWEIGHT_FILTERED_PERCENTS === "1";

type LangAgg = { name: string; seconds: number; percent: number };
function filterLanguages(items: LangAgg[]): LangAgg[] {
  const filtered = (items ?? []).filter(x => (x?.seconds ?? 0) >= MIN_LANG_SECONDS);

  if (!REWEIGHT_FILTERED_PERCENTS) return filtered;
  const total = filtered.reduce((a, b) => a + (b.seconds ?? 0), 0) || 1;
  return filtered.map(x => ({ ...x, percent: (x.seconds / total) * 100 }));
}

export interface FormattedStatBundle {
  timeframe: string;
  fetchedAt: string | null;
  source?: { 
    modified_at?: string | null;
    is_up_to_date?: boolean | null
  };
  daily_average: string | null
  total_time: string | null
  top_languages: Array<{ 
    name: string;
    time: string;
    percent: string
  }>;
  most_active_day: {
    date: string | null;
    time: string | null
  };
  top_projects: Array<{
    name: string;
    time: string;
    percent: string
  }>;
  languages_used: string[];
  languages_by_usage: Array<{
    name: string;
    time: string;
    percent: string
  }>;
}

type SectionKey = keyof FormattedStatBundle;
type Bundle = NormalizedStatBundle;

const sectionFormatters: Partial<Record<SectionKey, (b: Bundle, out: any) => void>> = {
  total_time: (b, out) => {
    out.total_time = {
      seconds: b.total_time.seconds,
      text: b.total_time.text,
      pretty: toFormattedTime(b.total_time.seconds),
    };
  },
  daily_average: (b, out) => {
    out.daily_average = {
      seconds: b.daily_average.seconds,
      text: b.daily_average.text,
      pretty: toFormattedTime(b.daily_average.seconds),
    };
  },
  most_active_day: (b, out) => {
    out.most_active_day = {
      date: b.most_active_day.date,
      seconds: b.most_active_day.seconds,
      text: b.most_active_day.text,
      pretty: toFormattedTime(b.most_active_day.seconds),
    };
  },
  top_projects: (b, out) => {
    out.top_projects = (b.top_projects || []).map((p) => ({
      ...p,
      time: toFormattedTime(p.seconds) || "0s",
      percent_pretty: toPercent(p.percent) || "0.0%",
    }));
  },
  top_languages: (b, out) => {
    out.top_languages = (b.top_languages || []).map((l) => ({
      ...l,
      time: toFormattedTime(l.seconds) || "0s",
      percent_pretty: toPercent(l.percent) || "0.0%",
    }));
  },
  languages_used: (b, out) => {
    out.languages_used = b.languages_used || [];
  },
  languages_by_usage: (b, out) => {
    out.languages_by_usage = (b.languages_by_usage || []).map((l) => ({
      ...l,
      time: toFormattedTime(l.seconds) || "0s",
      percent_pretty: toPercent(l.percent) || "0.0%",
    }));
  },
};

export function formatBundlePretty(b: NormalizedStatBundle): FormattedStatBundle {
  const langsFiltered = filterLanguages(b.languages_by_usage);
  const topLangsFiltered = langsFiltered.slice(0, 5);

  const langSlim = (arr: LangAgg[]) =>
    (arr ?? []).map(x => ({
      name: x.name,
      time: toFormattedTime(x.seconds) || "0s",
      percent: toPercent(x.percent) || "0.0%",
    }));

  const projSlim = (arr: Array<{ name: string; seconds: number; percent: number }>) =>
    (arr ?? []).map(x => ({
      name: x.name,
      time: toFormattedTime(x.seconds) || "0s",
      percent: toPercent(x.percent) || "0.0%",
    }));

  const srcModified = b.source?.modified_at ? toLocalDateTime(b.source.modified_at) : undefined;
  const srcUpToDate = typeof b.source?.is_up_to_date === "boolean" ? b.source.is_up_to_date : undefined;
  const src = (srcModified !== undefined || srcUpToDate !== undefined)
    ? { ...(srcModified !== undefined && { modified_at: srcModified }),
        ...(srcUpToDate !== undefined && { is_up_to_date: srcUpToDate }) }
    : undefined;

  const bundle: FormattedStatBundle = {
    timeframe: timeframeLabel(b.timeframe),
    fetchedAt: toLocalDateTime(b.fetchedAt),
    total_time: toFormattedTime(b.total_time.seconds),
    daily_average: toFormattedTime(b.daily_average.seconds),
    most_active_day: { date: toShortDate(b.most_active_day.date), time: toFormattedTime(b.most_active_day.seconds) },
    top_projects: projSlim(b.top_projects),
    top_languages: langSlim(topLangsFiltered),
    languages_used: langsFiltered.map(l => l.name),
    languages_by_usage: langSlim(langsFiltered),
  };

  if (src) bundle.source = src;
  return bundle;
}

export function formatMapPretty(raw: Record<ApiTimeframe, NormalizedStatBundle | null>): Record<ApiTimeframe, FormattedStatBundle | null> {
  const out: Partial<Record<ApiTimeframe, FormattedStatBundle | null>> = {};
  for (const [tf, v] of Object.entries(raw) as [ApiTimeframe, NormalizedStatBundle | null][]) {
    out[tf] = v ? formatBundlePretty(v) : null;
  }
  return out as Record<ApiTimeframe, FormattedStatBundle | null>;
}

export function registerSectionFormatter<K extends SectionKey>(key: K, fn: (b: Bundle, out: any) => void) {
  sectionFormatters[key] = fn as any;
}