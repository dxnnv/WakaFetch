export const TIMEFRAMES = [
  "today",
  "this_week",
  "last_7_days",
  "last_14_days",
  "this_month",
  "this_year",
  "all_time",
] as const;

export type ApiTimeframe = (typeof TIMEFRAMES)[number];
const TIMEFRAME_SET = new Set<ApiTimeframe>(TIMEFRAMES);

export function parseTimeframe(input?: string): ApiTimeframe | null {
  if (!input) return null;
  const key = input.trim().toLowerCase().replace(/[\s-]+/g, "_") as ApiTimeframe;
  return TIMEFRAME_SET.has(key) ? (key as ApiTimeframe) : null;
}

export const STAT_KEYS = [
  "daily_average",
  "total_time",
  "top_languages",
  "most_active_day",
  "top_projects",
  "languages_used",
  "languages_by_usage",
] as const;

export type StatKey = (typeof STAT_KEYS)[number];

export interface NormalizedStatBundle {
  timeframe: ApiTimeframe;
  fetchedAt: string; // ISO
  source: { modified_at?: string; is_up_to_date?: boolean };
  daily_average: { seconds: number | null; text: string | null };
  total_time: { seconds: number | null; text: string | null };
  top_languages: Array<{ name: string; seconds: number; percent: number }>;
  most_active_day: { date: string | null; seconds: number | null; text: string | null };
  top_projects: Array<{ name: string; seconds: number; percent: number }>;
  languages_used: string[];
  languages_by_usage: Array<{ name: string; percent: number; seconds: number }>;
}

export function parseStat(input?: string): StatKey | null {
  if (!input) return null;
  const k = input.trim().toLowerCase();
  return (STAT_KEYS as readonly string[]).includes(k) ? (k as StatKey) : null;
}