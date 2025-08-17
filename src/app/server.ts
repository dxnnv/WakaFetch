import "dotenv/config";
import express from "express";
import helmet from "helmet";
import { PrettyFormatters, RawFormatters } from "../formatting/formatters.js";
import { makeStatsRoute } from "./routes.js";

export const app = express();
const PORT = Number(process.env.PORT ?? 8080);

app.disable("x-powered-by");
app.use(helmet({ contentSecurityPolicy: false }));

app.set("etag", "strong");
app.set("json spaces", 0);

app.get("/wakatime/stats/raw", makeStatsRoute(RawFormatters));

app.get("/wakatime/stats", makeStatsRoute(PrettyFormatters));

app.get("/healthz", (_req, res) => res.json({ ok: true }));

app.listen(PORT, () => console.log(`WakaFetch listening on :${PORT}`));