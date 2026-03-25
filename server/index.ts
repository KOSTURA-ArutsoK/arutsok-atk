import express, { type Request, Response, NextFunction } from "express";
import { registerRoutes } from "./routes";
import { serveStatic } from "./static";
import { createServer } from "http";
import { db } from "./db";
import { subjectParameters, contractInventories, contracts } from "@shared/schema";
import { inArray, like, or, eq, isNull, and } from "drizzle-orm";

const app = express();
const httpServer = createServer(app);

declare module "http" {
  interface IncomingMessage {
    rawBody: unknown;
  }
}

app.use(
  express.json({
    verify: (req, _res, buf) => {
      req.rawBody = buf;
    },
  }),
);

app.use(express.urlencoded({ extended: false }));

export function log(message: string, source = "express") {
  const formattedTime = new Date().toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    second: "2-digit",
    hour12: true,
  });

  console.log(`${formattedTime} [${source}] ${message}`);
}

app.use((req, res, next) => {
  const start = Date.now();
  const path = req.path;
  let capturedJsonResponse: Record<string, any> | undefined = undefined;

  const originalResJson = res.json;
  res.json = function (bodyJson, ...args) {
    capturedJsonResponse = bodyJson;
    return originalResJson.apply(res, [bodyJson, ...args]);
  };

  res.on("finish", () => {
    const duration = Date.now() - start;
    if (path.startsWith("/api")) {
      let logLine = `${req.method} ${path} ${res.statusCode} in ${duration}ms`;
      if (capturedJsonResponse) {
        logLine += ` :: ${JSON.stringify(capturedJsonResponse)}`;
      }

      log(logLine);
    }
  });

  next();
});

(async () => {
  // Startup fixup: hide all legacy address params (adr_tp_* and adr_ka_* series)
  // that were superseded when the address panel was restructured into canonical
  // tp_* / ka_* keys (IDs 522–534).  Also hides the duplicate aml_pep (id=167).
  // Identified via full DB scan:
  //   adr_tp_ulica (117), adr_tp_cislo (118), adr_tp_psc (119), adr_tp_obec (120),
  //   adr_tp_okres (121), adr_tp_kraj (122), adr_tp_stat (123),
  //   adr_ka_rovnaka (124), adr_ka_ulica (125), adr_ka_cislo (126),
  //   adr_ka_psc (127), adr_ka_obec (128), adr_ka_okres (129),
  //   adr_ka_kraj (130), adr_ka_stat (131),
  //   aml_pep duplicate (167, FO) — superseded by canonical pep (562).
  // SZCO/PO do not have adr_* params (verified via full-table scan).
  // This update is idempotent (safe to repeat on every startup).
  try {
    await db.update(subjectParameters)
      .set({ isHidden: true })
      .where(or(
        like(subjectParameters.fieldKey, "adr_tp_%"),
        like(subjectParameters.fieldKey, "adr_ka_%"),
        eq(subjectParameters.id, 167),
      ));
  } catch (e) {
    console.warn("[startup] Could not hide legacy duplicate params:", e);
  }

  // Startup cleanup: soft-delete contract inventories that have no non-deleted contracts (orphaned/empty)
  try {
    const allActive = await db
      .select({ id: contractInventories.id })
      .from(contractInventories)
      .where(isNull(contractInventories.deletedAt));
    if (allActive.length > 0) {
      const withContracts = await db
        .selectDistinct({ inventoryId: contracts.inventoryId })
        .from(contracts)
        .where(and(
          eq(contracts.isDeleted, false),
          inArray(contracts.inventoryId, allActive.map(r => r.id))
        ));
      const activeIds = new Set(withContracts.map(r => r.inventoryId).filter((id): id is number => id !== null && id !== undefined));
      const emptyIds = allActive.map(r => r.id).filter(id => !activeIds.has(id));
      if (emptyIds.length > 0) {
        const now = new Date();
        await db.update(contractInventories)
          .set({ deletedAt: now })
          .where(inArray(contractInventories.id, emptyIds));
        console.log(`[CLEANUP] Soft-deleted ${emptyIds.length} empty inventory records: ${emptyIds.join(", ")}`);
      }
    }
  } catch (e) {
    console.warn("[startup] Could not clean up empty inventories:", e);
  }

  await registerRoutes(httpServer, app);

  app.use((err: any, _req: Request, res: Response, next: NextFunction) => {
    const status = err.status || err.statusCode || 500;
    const message = err.message || "Internal Server Error";

    console.error("Internal Server Error:", err);

    if (res.headersSent) {
      return next(err);
    }

    return res.status(status).json({ message });
  });

  // importantly only setup vite in development and after
  // setting up all the other routes so the catch-all route
  // doesn't interfere with the other routes
  if (process.env.NODE_ENV === "production") {
    serveStatic(app);
  } else {
    const { setupVite } = await import("./vite");
    await setupVite(httpServer, app);
  }

  // ALWAYS serve the app on the port specified in the environment variable PORT
  // Other ports are firewalled. Default to 5000 if not specified.
  // this serves both the API and the client.
  // It is the only port that is not firewalled.
  const port = parseInt(process.env.PORT || "5000", 10);
  httpServer.listen(
    {
      port,
      host: "0.0.0.0",
      reusePort: true,
    },
    () => {
      log(`serving on port ${port}`);
    },
  );
})();
