import "dotenv/config";
import express from "express";
import helmet from "helmet";
import { fetchStats } from "./wakaClient.js";
import { TIMEFRAMES, parseTimeframe, STAT_KEYS, type StatKey } from "./types.js";
import { dumpAll, getFromCache, isStale, setCache, shouldRefreshOnRequest } from "./cache.js";

const app = express();
const PORT = Number(process.env.PORT ?? 8080);

app.disable("x-powered-by");
app.use(helmet({ contentSecurityPolicy: false }));

function pickStat(bundle: any, stat?: string) {
  if (!stat) return bundle;

  const key = stat.trim().toLowerCase() as StatKey;
  if (!STAT_KEYS.includes(key))
    return { error: `Unknown stat '${stat}'. Valid: ${STAT_KEYS.join(", ")}` };

  return { timeframe: bundle.timeframe, fetchedAt: bundle.fetchedAt, [key]: bundle[key] };
}

async function ensureCached(tf: typeof TIMEFRAMES[number]): Promise<void> {
  const entry = getFromCache(tf);
  if (!entry || shouldRefreshOnRequest(entry)) {
    const fresh = await fetchStats(tf);
    setCache(tf, fresh);
  }
}

const safeLog = (...args: unknown[]) => {
  if (process.env.NODE_ENV === "production") return;
  console.log(...args);
};

app.get("/wakatime/stats", async (req, res) => {
  const timeframe = parseTimeframe(req.query.timeframe as string | undefined);
  const stat = req.query.stat as string | undefined;

  try {
    if (timeframe) {
      await ensureCached(timeframe);
      const entry = getFromCache(timeframe);
      if (!entry) return res.status(502).json({ error: "Failed to load stats." });

      // If entry is older than hard TTL, try one more refresh now
      if (isStale(entry))
        try { 
          setCache(timeframe, await fetchStats(timeframe)); 
        } catch {}
      
      return res.json(pickStat(getFromCache(timeframe)!.value, stat));
    }

    await Promise.all(TIMEFRAMES.map(tf => ensureCached(tf).catch(() => undefined)));
    return res.json(dumpAll());
  } catch (err) {
    safeLog(err);
    return res.status(500).json({ error: "Unexpected server error." });
  }
});

app.get("/healthz", (_req, res) => res.json({ ok: true }));
app.listen(PORT, () => console.log(`WakaFetch listening on :${PORT}`));