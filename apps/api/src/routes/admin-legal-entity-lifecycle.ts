import { zValidator } from "@hono/zod-validator";
import type { Context, Hono } from "hono";
import { z } from "zod";
import { asHttpStatus } from "../lib/http-status.js";
import type { LifecycleAdminOp } from "../lib/legal-entity-lifecycle-transitions.js";
import { createRequireCapability } from "../middleware/require-capability.js";
import type { IAdminLegalEntityLifecycleApplicationService } from "../services/interfaces/admin-routes.js";

const legalEntityIdParamSchema = z.object({
  id: z.string().uuid(),
});

const reasonBodySchema = z.object({
  reason: z.string().min(3).max(4000),
});

const rejectBodySchema = reasonBodySchema.extend({
  confirmationPhrase: z.literal("REJECT"),
});

const archiveBodySchema = reasonBodySchema.extend({
  confirmationPhrase: z.string().min(1).max(500),
});

const requireLegalEntityRead = createRequireCapability("legal_entity.read");
const requireLegalEntityWrite = createRequireCapability("legal_entity.write");
const requireLegalEntityApprove = createRequireCapability("legal_entity.approve");
const requireLegalEntityArchive = createRequireCapability("legal_entity.archive");

type AdminCtx = Context<{ Variables: { userId?: string; userRole?: string } }>;

async function runLifecycle(
  c: AdminCtx,
  legalEntityLifecycle: IAdminLegalEntityLifecycleApplicationService,
  entityId: string,
  op: LifecycleAdminOp,
  reason?: string | null,
) {
  const userId = c.get("userId");
  if (!userId) return c.json({ error: "Unauthorized" }, 401);
  const result = await legalEntityLifecycle.runTransition(userId, entityId, op, reason);
  return result.match(
    (data) => c.json({ data }),
    (e) => c.json({ error: e.code, message: e.message }, asHttpStatus(e.status)),
  );
}

/** admin legal entity verification lifecycle.
 * Mounted under `/admin` (platform segment already enforces auth + platform admin).
 */
export function attachAdminLegalEntityLifecycleRoutes(
  platform: Hono<{ Variables: { userId?: string; userRole?: string } }>,
  legalEntityLifecycle: IAdminLegalEntityLifecycleApplicationService,
) {
  platform.get(
    "/legal-entities/:id",
    requireLegalEntityRead,
    zValidator("param", legalEntityIdParamSchema),
    async (c) => {
      const { id } = c.req.valid("param");
      const entity = await legalEntityLifecycle.findLegalEntityById(id);
      if (!entity) {
        return c.json({ error: "Not found" }, 404);
      }
      return c.json({ data: entity });
    },
  );

  platform.post(
    "/legal-entities/:id/request-docs",
    requireLegalEntityWrite,
    zValidator("param", legalEntityIdParamSchema),
    async (c) => {
      const { id } = c.req.valid("param");
      return runLifecycle(c, legalEntityLifecycle, id, "request_docs");
    },
  );

  platform.post(
    "/legal-entities/:id/start-review",
    requireLegalEntityWrite,
    zValidator("param", legalEntityIdParamSchema),
    async (c) => {
      const { id } = c.req.valid("param");
      return runLifecycle(c, legalEntityLifecycle, id, "start_review");
    },
  );

  platform.post(
    "/legal-entities/:id/approve",
    requireLegalEntityApprove,
    zValidator("param", legalEntityIdParamSchema),
    async (c) => {
      const { id } = c.req.valid("param");
      return runLifecycle(c, legalEntityLifecycle, id, "approve");
    },
  );

  platform.post(
    "/legal-entities/:id/restrict",
    requireLegalEntityWrite,
    zValidator("param", legalEntityIdParamSchema),
    async (c) => {
      const { id } = c.req.valid("param");
      return runLifecycle(c, legalEntityLifecycle, id, "restrict");
    },
  );

  platform.post(
    "/legal-entities/:id/reject",
    requireLegalEntityApprove,
    zValidator("param", legalEntityIdParamSchema),
    zValidator("json", rejectBodySchema),
    async (c) => {
      const { id } = c.req.valid("param");
      const { reason } = c.req.valid("json");
      return runLifecycle(c, legalEntityLifecycle, id, "reject", reason);
    },
  );

  platform.post(
    "/legal-entities/:id/archive",
    requireLegalEntityArchive,
    zValidator("param", legalEntityIdParamSchema),
    zValidator("json", archiveBodySchema),
    async (c) => {
      const { id } = c.req.valid("param");
      const { reason, confirmationPhrase } = c.req.valid("json");
      const entity = await legalEntityLifecycle.findLegalEntityById(id);
      if (!entity) {
        return c.json({ error: "not_found", message: "Legal entity not found" }, 404);
      }
      const expected = `ARCHIVE ${entity.displayName}`;
      if (confirmationPhrase !== expected) {
        return c.json(
          {
            error: "confirmation_mismatch",
            message: `Type exactly: ${expected}`,
          },
          400,
        );
      }
      return runLifecycle(c, legalEntityLifecycle, id, "archive", reason);
    },
  );
}
