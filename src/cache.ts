import { ApiTimeframe, TIMEFRAMES, type NormalizedStatBundle } from "./types.js";

type Entry = { value: NormalizedStatBundle; updatedAt: number };
const store = new Map<ApiTimeframe, Entry>();

const hours = (h: number) => h * 60 * 60 * 1000;
const minutes = (m: number) => m * 60 * 1000;

const TTL_MS = hours(Number(process.env.CACHE_TTL_HOURS ?? 6));
const MIN_REFRESH_MS = minutes(Number(process.env.REFRESH_MIN_AGE_MINUTES ?? 10));

export function getFromCache(tf: ApiTimeframe) {
  return store.get(tf);
}

export function isStale(e: Entry) {
  return Date.now() - e.updatedAt > TTL_MS;
}

export function shouldRefreshOnRequest(e?: Entry) {
  return !e || Date.now() - e.updatedAt > MIN_REFRESH_MS;
}

export function setCache(tf: ApiTimeframe, value: NormalizedStatBundle) {
  store.set(tf, { value, updatedAt: Date.now() });
}

export function dumpAll(): Record<ApiTimeframe, NormalizedStatBundle | null> {
  return Object.fromEntries(
    TIMEFRAMES.map((tf) => [tf, store.get(tf)?.value ?? null]),
  ) as Record<ApiTimeframe, NormalizedStatBundle | null>;
}