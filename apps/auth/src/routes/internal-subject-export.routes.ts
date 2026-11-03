import { createHash, timingSafeEqual } from "node:crypto";
import {
  SUBJECT_EXPORT_MANIFEST_SUBROUTE,
  SUBJECT_EXPORT_PAGE_SUBROUTE,
  SUBJECT_EXPORT_PROGRESS_SUBROUTE,
  SUBJECT_EXPORT_PURGED_SUBROUTE,
  SUBJECT_EXPORT_PURGE_PENDING_SUBROUTE,
  subjectExportProgressSchema,
} from "@auction/identity-contracts";
import type { Context, Hono } from "hono";
import type { SubjectExportService } from "../services/subject-export.service.js";
import {
  type SubjectExportReader,
  UnknownSubjectExportCategoryError,
} from "../subject-export/subject-export-reader.service.js";
import { InvalidSubjectExportCursorError } from "../subject-export/subject-export.types.js";

/** The machine credential the worker uses for the export routes. It is not the lifecycle credential. */
export type SubjectExportMachineDeps = {
  exports: Pick<
    SubjectExportService,
    "applyProgress" | "pendingObjectPurges" | "confirmObjectPurged"
  >;
  /** Answers for LAX Account's own data, the same way Bid and Shop answer for theirs. */
  reader: Pick<SubjectExportReader, "manifest" | "page">;
  /** Tokens issued for the `subject_export` scope are stored and looked up under their own key. */
  redis: { get(key: string): Promise<string | null> };
  clientId: string;
  clientSecret: string;
  /** Seconds to wait when this request is over its budget, otherwise null. */
  rateLimit(exportId: string): Promise<number | null>;
  /** The same for reads, per person. */
  readRateLimit(subjectId: string): Promise<number | null>;
  onFailure?: (error: unknown) => void;
};

/** Where an export-scope token lives; the lifecycle routes never look here, nor these routes there. */
export function subjectExportTokenKey(token: string): string {
  return `identity:subject-export-token:${createHash("sha256").update(token).digest("hex")}`;
}

function safeEqual(left: string, right: string): boolean {
  return timingSafeEqual(
    createHash("sha256").update(left).digest(),
    createHash("sha256").update(right).digest(),
  );
}

const MAX_PURGE_BATCH = 100;

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * The worker's progress reports. Mounted before the lifecycle routes' own authentication, so
 * it accepts only a token issued for the `subject_export` scope and a lifecycle token is refused
 * here just as an export token is refused there. Reports are applied once: a repeat answers
 * `ignored`, which the worker treats as success.
 */
export function mountSubjectExportMachineRoutes(app: Hono, deps: SubjectExportMachineDeps): void {
  const path = `/identity${SUBJECT_EXPORT_PROGRESS_SUBROUTE}`;

  async function hasExportToken(c: Context): Promise<boolean> {
    const authorization = c.req.header("authorization");
    const token = authorization?.startsWith("Bearer ") ? authorization.slice(7) : "";
    const clientId = token ? await deps.redis.get(subjectExportTokenKey(token)) : null;
    return clientId !== null && safeEqual(clientId, deps.clientId);
  }

  /** Reads carry personal data: never cached, and a person's budget is per subject. */
  async function guardRead(c: Context) {
    c.header("Cache-Control", "no-store");
    if (!(await hasExportToken(c))) return c.json({ error: "unauthorized" }, 401);
    const retryAfterSec = await deps.readRateLimit(c.req.param("subjectId") ?? "");
    if (retryAfterSec !== null) {
      c.header("Retry-After", String(retryAfterSec));
      return c.json({ error: "rate_limited" }, 429);
    }
    return null;
  }

  app.get(`/identity${SUBJECT_EXPORT_MANIFEST_SUBROUTE}`, async (c) => {
    const refused = await guardRead(c);
    if (refused) return refused;
    try {
      return c.json(await deps.reader.manifest(c.req.param("subjectId")));
    } catch (error) {
      deps.onFailure?.(error);
      return c.json({ error: "subject_export_unavailable" }, 503);
    }
  });

  app.get(`/identity${SUBJECT_EXPORT_PAGE_SUBROUTE}`, async (c) => {
    const refused = await guardRead(c);
    if (refused) return refused;
    try {
      return c.json(
        await deps.reader.page(
          c.req.param("subjectId"),
          c.req.param("category"),
          c.req.query("cursor") ?? null,
        ),
      );
    } catch (error) {
      if (error instanceof UnknownSubjectExportCategoryError) {
        return c.json({ error: "unknown_export_category" }, 404);
      }
      if (error instanceof InvalidSubjectExportCursorError) {
        return c.json({ error: "invalid_export_cursor" }, 400);
      }
      deps.onFailure?.(error);
      return c.json({ error: "subject_export_unavailable" }, 503);
    }
  });

  app.post(path, async (c) => {
    c.header("Cache-Control", "no-store");
    if (!(await hasExportToken(c))) return c.json({ error: "unauthorized" }, 401);
    const exportId = c.req.param("exportId");
    if (!UUID.test(exportId)) return c.json({ error: "invalid_request" }, 400);
    const retryAfterSec = await deps.rateLimit(exportId);
    if (retryAfterSec !== null) {
      c.header("Retry-After", String(retryAfterSec));
      return c.json({ error: "rate_limited" }, 429);
    }
    const report = subjectExportProgressSchema.safeParse(await c.req.json().catch(() => null));
    if (!report.success) return c.json({ error: "invalid_request" }, 400);
    try {
      const result = await deps.exports.applyProgress(exportId, report.data);
      if (result === "not_found") return c.json({ error: "not_found" }, 404);
      if (result === "invalid_object_key") return c.json({ error: "invalid_object_key" }, 422);
      return c.json({ result });
    } catch (error) {
      deps.onFailure?.(error);
      return c.json({ error: "temporarily_unavailable" }, 503);
    }
  });
  // Stored copies to delete. The worker deletes each object, then confirms it below.
  app.get(`/identity${SUBJECT_EXPORT_PURGE_PENDING_SUBROUTE}`, async (c) => {
    c.header("Cache-Control", "no-store");
    if (!(await hasExportToken(c))) return c.json({ error: "unauthorized" }, 401);
    const requested = Number.parseInt(c.req.query("limit") ?? "", 10);
    const limit = Number.isInteger(requested)
      ? Math.min(Math.max(requested, 1), MAX_PURGE_BATCH)
      : MAX_PURGE_BATCH;
    try {
      return c.json({ items: await deps.exports.pendingObjectPurges(limit) });
    } catch (error) {
      deps.onFailure?.(error);
      return c.json({ error: "temporarily_unavailable" }, 503);
    }
  });

  app.post(`/identity${SUBJECT_EXPORT_PURGED_SUBROUTE}`, async (c) => {
    c.header("Cache-Control", "no-store");
    if (!(await hasExportToken(c))) return c.json({ error: "unauthorized" }, 401);
    const exportId = c.req.param("exportId");
    if (!UUID.test(exportId)) return c.json({ error: "invalid_request" }, 400);
    try {
      return c.json({ result: await deps.exports.confirmObjectPurged(exportId) });
    } catch (error) {
      deps.onFailure?.(error);
      return c.json({ error: "temporarily_unavailable" }, 503);
    }
  });
}
