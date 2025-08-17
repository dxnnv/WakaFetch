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
  if (seconds == null) return null;
  const s = Math.max(0, Math.round(seconds));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  const parts = [];
  if (h) parts.push(`${h}h`);
  if (m || h) parts.push(`${m}m`);
  parts.push(`${sec}s`);
  return parts.join(" ");
}

export function toPercent(
  value: number | null | undefined,
  digits = 1
): string | null {
  if (value == null || Number.isNaN(value)) return null;
  return `${Number(value).toFixed(digits)}%`;
}

export function toLocalDateTime(iso: string | null | undefined): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
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