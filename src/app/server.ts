import "dotenv/config";
import fs from "node:fs";
import express from "express";
import helmet from "helmet";
import compression from "compression";
import rateLimit from "express-rate-limit";
import { PrettyFormatters, RawFormatters } from "../formatting/formatters.js";
import { makeStatsRoute } from "./routes.js";

export const app = express();
const PORT = Number(process.env.PORT ?? 23116);
const SOCK = process.env.SOCKET_PATH
const BASE_PATH = process.env.BASE_PATH ?? "/wakatime";

app.disable("x-powered-by");
app.set("trust proxy", 1);
app.set("etag", "strong");
app.set("json spaces", 0);
app.use(compression());
app.use(helmet({ contentSecurityPolicy: false }));

const router = express.Router();
router.get("/stats/raw", makeStatsRoute(RawFormatters));
router.get("/stats", makeStatsRoute(PrettyFormatters));
router.get("/healthz", (_req, res) => res.json({ ok: true }));
router.get("/version", (_req, res) => res.json({
  version: process.env.npm_package_version ?? "dev",
  commit: process.env.GIT_SHA ?? null,
}));

router.use(rateLimit({ windowMs: 60_000, limit: 120, standardHeaders: true, legacyHeaders: false }));
app.use(BASE_PATH, router);

let server: any;
function onListening(where: string) {
  console.log(`[${new Date().toISOString()}] listening on ${where} at ${BASE_PATH}`);
}

if (SOCK) {
  try {
    if (fs.existsSync(SOCK))
      fs.unlinkSync(SOCK);
    } catch {}
  server = app.listen(SOCK, () => {
    try { 
      fs.chmodSync(SOCK, 0o766);
    } catch {}
    onListening(`unix:${SOCK}`);
  });
} else server = app.listen(PORT, () => onListening(`:${PORT}`));

function shutdown(sig: string) {
  console.log(`${sig} received, shutting down…`);
  server.close(() => {
    if (SOCK) { 
      try { fs.unlinkSync(SOCK);
    } catch {} }
    process.exit(0);
  });
  setTimeout(() => process.exit(1), 10_000).unref();
}

["SIGINT","SIGTERM"].forEach(s => process.on(s as NodeJS.Signals, () => shutdown(s)));