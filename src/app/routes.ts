import type { Handler, Request, Response } from "express";
import { TIMEFRAMES, parseTimeframe, parseStat, STAT_KEYS, type ApiTimeframe, type NormalizedStatBundle, type StatKey } from "../types.js";
import { fetchStats } from "../wakaClient.js";
import { dumpAll, getFromCache, isStale, setCache, shouldRefreshOnRequest } from "../cache.js";
import type { Formatters } from "../formatting/formatters.js";

const safeLog = (...args: unknown[]) => {
  if (process.env.NODE_ENV !== "production") console.log(...args.map(a => (a instanceof Error ? a.stack ?? a.message : a)));
};

const inflight = new Map<ApiTimeframe, Promise<NormalizedStatBundle>>();

async function ensureCached(tf: ApiTimeframe): Promise<void> {
  const entry = getFromCache(tf);
  if (entry && !shouldRefreshOnRequest(entry)) return;
  let promise = inflight.get(tf);
  if (!promise) {
    promise = fetchStats(tf).finally(() => inflight.delete(tf));
    inflight.set(tf, promise);
  }
  const fresh = await promise;
  setCache(tf, fresh)
}

export function makeStatsRoute<Bundle = any, MapOut = any>(fmt: Formatters<Bundle, MapOut>): Handler {
  return async (req: Request, res: Response) => {
    const timeframe = parseTimeframe(req.query.timeframe as string | undefined);
    if (req.query.timeframe && !timeframe)
      return res.status(400).json({ error: "Invalid timeframe." });


    const stat = parseStat(req.query.stat as string | undefined) ?? undefined;
    if (req.query.stat && !stat)
      return res.status(400).json({ error: `Unknown stat. Valid: ${STAT_KEYS.join(", ")}` });

    try {
      if (timeframe) {
        await ensureCached(timeframe);
        const entry = getFromCache(timeframe);
        if (!entry) return res.status(502).json({ error: "Failed to load stats." });

        if (isStale(entry))
          try {
            setCache(timeframe, await fetchStats(timeframe));
          } catch (e) {
            safeLog("Refresh failed:", e);
          }

        const formatted = fmt.formatBundle(getFromCache(timeframe)!.value);
        if (!stat) return res.json(formatted);

        const picked = fmt.pick(formatted, stat);
        return res.json(picked);
      }

      await Promise.allSettled(TIMEFRAMES.map(tf => ensureCached(tf)));
      const mapOut = fmt.formatMap(dumpAll());
      return res.json(mapOut);
    } catch (err) {
      safeLog(err);
      return res.status(500).json({ error: "Unexpected server error." });
    }
  };
}