import express from "express";
import cors from "cors";
import path from "path";
import { createServer } from "http";
import { registerRoutes } from "./routes.js";
import { serveStatic } from "./static.js";
import { setupVite } from "./vite.js";
import { globalLimiter } from "./middlewares/rateLimit.js";
import { securityHeaders } from "./middlewares/securityHeaders.js";

const app = express();
const httpServer = createServer(app);
const isProduction = process.env.NODE_ENV === "production";

app.use(securityHeaders);
app.use("/api", globalLimiter);
app.use(cors({
  exposedHeaders: ['RateLimit-Policy', 'RateLimit-Limit', 'RateLimit-Remaining', 'RateLimit-Reset']
}));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: false, limit: '10mb' }));

app.use((req, res, next) => {
  const originalJson = res.json.bind(res);
  res.json = (payload) => {
    if (req.path.startsWith("/api") && res.statusCode >= 400) {
      const message = payload?.error || payload?.message || "Request failed";
      return originalJson({ error: String(message) });
    }
    return originalJson(payload);
  };
  next();
});

function log(message, source = "express") {
  if (isProduction) return;
  const formattedTime = new Date().toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    second: "2-digit",
    hour12: true,
  });
  process.stdout.write(`${formattedTime} [${source}] ${message}\n`);
}

function logError(message, error, metadata = {}) {
  if (isProduction) {
    console.error(message, {
      name: error?.name,
      message: error?.message,
      ...metadata,
    });
    return;
  }

  console.error(message, error);
}

app.use((req, res, next) => {
  if (isProduction) {
    return next();
  }

  const start = Date.now();
  const requestPath = req.path;

  res.on("finish", () => {
    const duration = Date.now() - start;
    if (requestPath.startsWith("/api")) {
      log(`${req.method} ${requestPath} ${res.statusCode} in ${duration}ms`);
    }
  });

  next();
});

(async () => {
  await registerRoutes(httpServer, app);

  app.use("/uploads", express.static(path.join(process.cwd(), "uploads")));

  app.use((err, _req, res, _next) => {
    const status = err.status || err.statusCode || 500;
    logError("Unhandled API error", err, { status });

    if (status >= 500) {
      return res.status(500).json({ error: "Internal server error" });
    }

    return res.status(status).json({ error: err.publicMessage || "Request failed" });
  });

  if (isProduction) {
    serveStatic(app);
  } else {
    await setupVite(httpServer, app);
  }

  const port = parseInt(process.env.PORT || "5000", 10);
  httpServer.listen(port, () => {
    log(`serving on http://localhost:${port}`);
  });
})();
