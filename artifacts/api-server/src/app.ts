import express, { type Express } from "express";
import cors from "cors";
import pinoHttp from "pino-http";
import router from "./routes";
import { logger } from "./lib/logger";
import cookieParser from "cookie-parser";
import { authMiddleware } from "./middlewares/authMiddleware";

const app: Express = express();

app.use(
  pinoHttp({
    logger,
    serializers: {
      req(req) {
        return {
          id: req.id,
          method: req.method,
          url: req.url?.split("?")[0],
        };
      },
      res(res) {
        return {
          statusCode: res.statusCode,
        };
      },
    },
  }),
);
app.set("trust proxy", 1);
app.use(cors({ credentials: true, origin: false }));
app.use(cookieParser());
app.use(express.json({ limit: "128kb" }));
app.use(express.urlencoded({ extended: true }));
app.use(authMiddleware);
app.use((req, res, next) => {
  res.setHeader("Cache-Control", "no-store");
  if (!["GET", "HEAD", "OPTIONS"].includes(req.method)) {
    const origin = req.get("origin");
    if (origin) {
      let valid = false;
      try {
        const parsed = new URL(origin);
        valid = ["https:", "http:"].includes(parsed.protocol) &&
          (parsed.host === req.get("host") || parsed.host === req.get("x-forwarded-host"));
      } catch { /* Reject malformed Origin rather than returning an internal error. */ }
      if (!valid) { res.status(403).json({ error: "UNAUTHORIZED" }); return; }
    }
  }
  next();
});

app.use("/api", router);
app.use((err: unknown, req: express.Request, res: express.Response, _next: express.NextFunction) => {
  const e = err as { status?: number; code?: string; message?: string; name?: string; cause?: { code?: string } };
  if (e.code === "23505" || e.cause?.code === "23505") { res.status(409).json({ error: "DUPLICATE_REFERENCE" }); return; }
  if (e.name === "ZodError") { res.status(400).json({ error: "INVALID_INPUT" }); return; }
  if (e.status) { res.status(e.status).json({ error: e.message }); return; }
  req.log.error({ name: e.name }, "Request failed");
  res.status(500).json({ error: "SERVER_ERROR" });
});

export default app;
