import type { ApiTimeframe } from "../types.js";

const TIMEZONE = process.env.TIMEZONE || "America/New_York";
const DATE_FMT = new Intl.DateTimeFormat("en-US", {
  timeZone: TIMEZONE,
  year: "2-digit",
  month: "numeric",
  day: "numeric",
  hour: "numeric",
  minute: "2-digit",
  second: "2-digit",
  hour12: false,
});

export function timeframeLabel(tf: ApiTimeframe): string {
  return tf.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

export function toFormattedTime(seconds: number | null | undefined): string | null {
  if (!seconds || seconds <= 0) return null;
  const total = Math.floor(seconds);
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  const parts = [];
  if (h) parts.push(`${h}h`);
  if (m || h) parts.push(`${m}m`);
  parts.push(`${s}s`);
  return parts.join(" ");
}

export function toPercent(pct: number | null | undefined, fractionDigits = 1): string | null {
  if (pct == null) return null;
  return `${pct.toFixed(fractionDigits)}%`;
}

export function toLocalDateTime(iso: string | null | undefined): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  return DATE_FMT.format(d).replace(",", "");
}

export function toShortDate(ymdLike: string | null | undefined): string | null {
  if (!ymdLike) return null;
  const ymd = ymdLike.split("T")[0];
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(ymd);
  if (!m) return ymdLike;
  const [, y, mo, d] = m;
  const yy = y.slice(2);
  return `${parseInt(mo, 10)}/${parseInt(d, 10)}/${yy}`;
}