import "dotenv/config";
import express from "express";
import helmet from "helmet";
import { PrettyFormatters, RawFormatters } from "../formatting/formatters.js";
import { makeStatsRoute } from "./routes.js";

export const app = express();
const PORT = Number(process.env.PORT ?? 23116);
const SOCK = process.env.SOCK
const BASE_PATH = process.env.BASE_PATH ?? "/wakatime";

app.disable("x-powered-by");
app.use(helmet({ contentSecurityPolicy: false }));

app.set("etag", "strong");
app.set("json spaces", 0);

app.get("/wakatime/stats/raw", makeStatsRoute(RawFormatters));

app.get("/wakatime/stats", makeStatsRoute(PrettyFormatters));

app.get("/healthz", (_req, res) => res.json({ ok: true }));


if (SOCK)
  app.listen({ path: SOCK, readableAll: true, writableAll: true }, () => {
    console.log(`WakaFetch listening on unix socket ${SOCK}`);
  });
else 
  app.listen(PORT, () => console.log(`WakaFetch listening on :${PORT}`));
