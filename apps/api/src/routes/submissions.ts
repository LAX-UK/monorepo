import type { CreateItemSubmissionInput, UpdateItemSubmissionInput } from "@auction/types";
import { type UserRole, roleHasCapability } from "@auction/types";
import {
  adminBulkSubmissionsBodySchema,
  adminSubmissionNotesSchema,
  approveSubmissionBodySchema,
  createItemSubmissionSchema,
  listSubmissionsQuerySchema,
  rejectSubmissionBodySchema,
  submissionIdParamSchema,
  updateItemSubmissionSchema,
} from "@auction/validators";
import { zValidator } from "@hono/zod-validator";
import { Hono } from "hono";
import type { Container } from "../container.js";
import { asHttpStatus } from "../lib/http-status.js";
import { presentSubmissionImages, presentSubmissionsImages } from "../lib/media-presenters.js";
import { createRequireAuth } from "../middleware/require-auth.js";
import {
  requireBuyerRole,
  requireBuyerRoleUnlessAdministrator,
} from "../middleware/require-buyer-role.js";
import { requirePlatformAdmin } from "../middleware/require-capability.js";
import type { LegalEntityContext } from "../middleware/require-legal-entity-context.js";
import type { IAuthenticator } from "../services/interfaces/authenticator.js";

export function createSubmissionRoutes(container: Container, authenticator: IAuthenticator) {
  const requireAuth = createRequireAuth(authenticator, {
    isSuspended: (id) => container.userSuspensionChecker.isSuspended(id),
  });

  const requireSubmissionEntityContext = container.requireSubmissionsLegalEntityContext;
  const r = new Hono<{
    Variables: { userId?: string; userRole?: string; legalEntityContext?: LegalEntityContext };
  }>();

  r.post(
    "/",
    requireAuth,
    requireSubmissionEntityContext,
    zValidator("json", createItemSubmissionSchema),
    async (c) => {
      const body = c.req.valid("json") as Partial<CreateItemSubmissionInput>;
      const ctx = c.get("legalEntityContext") as LegalEntityContext;
      // `legalEntityId` is intentionally not accepted by today's Zod schema.
      // Keep the server-side source of truth here so future schema refactors
      // cannot accidentally let callers submit on behalf of another entity.
      const input = {
        ...body,
        legalEntityId: ctx.legalEntityId,
      } as CreateItemSubmissionInput;
      const result = await container.itemSubmissionService.createDraft(ctx.legalEntityId, input);
      if (result.isErr())
        return c.json({ error: result.error.message }, asHttpStatus(result.error.status));
      return c.json(
        { data: await presentSubmissionImages(container.mediaUrlResolver, result.value) },
        201,
      );
    },
  );

  r.get("/mine", requireAuth, zValidator("query", listSubmissionsQuerySchema), async (c) => {
    const userId = c.get("userId") as string;
    const entity = await container.legalEntityRepository.ensurePersonalEntity(userId);
    const q = c.req.valid("query");
    const rows = await container.itemSubmissionService.listForSeller(entity.id, {
      status: q.status,
      limit: q.limit,
      offset: q.offset,
    });
    return c.json({ data: await presentSubmissionsImages(container.mediaUrlResolver, rows) });
  });

  r.get(
    "/",
    requireAuth,
    requirePlatformAdmin,
    zValidator("query", listSubmissionsQuerySchema),
    async (c) => {
      const q = c.req.valid("query");
      const rows = await container.itemSubmissionService.listForAdmin({
        status: q.status,
        legalEntityId: q.sellerId,
        q: q.q,
        limit: q.limit,
        offset: q.offset,
      });
      return c.json({ data: await presentSubmissionsImages(container.mediaUrlResolver, rows) });
    },
  );

  r.get("/:id", requireAuth, zValidator("param", submissionIdParamSchema), async (c) => {
    const { id } = c.req.valid("param");
    const role = (c.get("userRole") ?? "client") as UserRole;
    const userId = c.get("userId") as string;
    if (roleHasCapability(role, "platform.admin.full")) {
      const result = await container.itemSubmissionService.getForAdmin(id);
      if (result.isErr()) {
        return c.json({ error: result.error.message }, asHttpStatus(result.error.status));
      }
      return c.json({
        data: await presentSubmissionImages(container.mediaUrlResolver, result.value),
      });
    }
    const entity = await container.legalEntityRepository.ensurePersonalEntity(userId);
    const result = await container.itemSubmissionService.getForSeller(entity.id, id);
    if (result.isErr())
      return c.json({ error: result.error.message }, asHttpStatus(result.error.status));
    return c.json({
      data: await presentSubmissionImages(container.mediaUrlResolver, result.value),
    });
  });

  r.patch(
    "/:id",
    requireAuth,
    requireBuyerRoleUnlessAdministrator,
    zValidator("param", submissionIdParamSchema),
    async (c) => {
      const { id } = c.req.valid("param");
      const role = (c.get("userRole") ?? "client") as UserRole;
      const userId = c.get("userId") as string;
      const entity = await container.legalEntityRepository.ensurePersonalEntity(userId);
      let raw: unknown = {};
      try {
        raw = await c.req.json();
      } catch {
        raw = {};
      }
      if (roleHasCapability(role, "platform.admin.full")) {
        const parsed = adminSubmissionNotesSchema.safeParse(raw);
        if (!parsed.success) {
          return c.json({ error: "Invalid body", details: parsed.error.flatten() }, 400);
        }
        const result = await container.itemSubmissionService.updateForActor({
          actorId: userId,
          role,
          submissionId: id,
          adminNotes: parsed.data,
        });
        if (result.isErr()) {
          return c.json({ error: result.error.message }, asHttpStatus(result.error.status));
        }
        return c.json({
          data: await presentSubmissionImages(container.mediaUrlResolver, result.value),
        });
      }
      const parsed = updateItemSubmissionSchema.safeParse(raw);
      if (!parsed.success) {
        return c.json({ error: "Invalid body", details: parsed.error.flatten() }, 400);
      }
      const result = await container.itemSubmissionService.updateForActor({
        actorId: entity.id,
        role,
        submissionId: id,
        sellerPatch: parsed.data as UpdateItemSubmissionInput,
      });
      if (result.isErr()) {
        return c.json({ error: result.error.message }, asHttpStatus(result.error.status));
      }
      return c.json({
        data: await presentSubmissionImages(container.mediaUrlResolver, result.value),
      });
    },
  );

  r.post(
    "/:id/submit",
    requireAuth,
    requireBuyerRole,
    zValidator("param", submissionIdParamSchema),
    async (c) => {
      const userId = c.get("userId") as string;
      const entity = await container.legalEntityRepository.ensurePersonalEntity(userId);
      const { id } = c.req.valid("param");
      const result = await container.itemSubmissionService.submitForReview(entity.id, id);
      if (result.isErr()) {
        return c.json({ error: result.error.message }, asHttpStatus(result.error.status));
      }
      return c.json({
        data: await presentSubmissionImages(container.mediaUrlResolver, result.value),
      });
    },
  );

  r.post(
    "/:id/withdraw",
    requireAuth,
    requireBuyerRole,
    zValidator("param", submissionIdParamSchema),
    async (c) => {
      const userId = c.get("userId") as string;
      const entity = await container.legalEntityRepository.ensurePersonalEntity(userId);
      const { id } = c.req.valid("param");
      const result = await container.itemSubmissionService.withdraw(entity.id, id);
      if (result.isErr()) {
        return c.json({ error: result.error.message }, asHttpStatus(result.error.status));
      }
      return c.json({
        data: await presentSubmissionImages(container.mediaUrlResolver, result.value),
      });
    },
  );

  r.post(
    "/:id/review/start",
    requireAuth,
    requirePlatformAdmin,
    zValidator("param", submissionIdParamSchema),
    async (c) => {
      const adminId = c.get("userId") as string;
      const { id } = c.req.valid("param");
      const result = await container.itemSubmissionService.startReview(adminId, id);
      if (result.isErr()) {
        return c.json({ error: result.error.message }, asHttpStatus(result.error.status));
      }
      return c.json({
        data: await presentSubmissionImages(container.mediaUrlResolver, result.value),
      });
    },
  );

  r.post(
    "/bulk",
    requireAuth,
    requirePlatformAdmin,
    zValidator("json", adminBulkSubmissionsBodySchema),
    async (c) => {
      const adminId = c.get("userId") as string;
      const { ids, op, reason, reviewNotes } = c.req.valid("json");
      if (op === "reject" && !reason?.trim()) {
        return c.json({ error: "Reason is required to reject submissions" }, 400);
      }
      for (const id of ids) {
        const result =
          op === "approve"
            ? await container.itemSubmissionService.approve(adminId, id, reviewNotes)
            : await container.itemSubmissionService.reject(
                adminId,
                id,
                reason?.trim() ?? "",
                reviewNotes,
              );
        if (result.isErr()) {
          return c.json({ error: result.error.message }, asHttpStatus(result.error.status));
        }
      }
      return c.json({ ok: true, data: { count: ids.length } });
    },
  );

  r.post(
    "/:id/approve",
    requireAuth,
    requirePlatformAdmin,
    zValidator("param", submissionIdParamSchema),
    zValidator("json", approveSubmissionBodySchema),
    async (c) => {
      const adminId = c.get("userId") as string;
      const { id } = c.req.valid("param");
      const { reviewNotes } = c.req.valid("json");
      const result = await container.itemSubmissionService.approve(adminId, id, reviewNotes);
      if (result.isErr()) {
        return c.json({ error: result.error.message }, asHttpStatus(result.error.status));
      }
      return c.json({
        data: {
          submission: await presentSubmissionImages(
            container.mediaUrlResolver,
            result.value.submission,
          ),
          lot: result.value.lot,
        },
      });
    },
  );

  r.post(
    "/:id/reject",
    requireAuth,
    requirePlatformAdmin,
    zValidator("param", submissionIdParamSchema),
    zValidator("json", rejectSubmissionBodySchema),
    async (c) => {
      const adminId = c.get("userId") as string;
      const { id } = c.req.valid("param");
      const { rejectionReason, reviewNotes } = c.req.valid("json");
      const result = await container.itemSubmissionService.reject(
        adminId,
        id,
        rejectionReason,
        reviewNotes,
      );
      if (result.isErr()) {
        return c.json({ error: result.error.message }, asHttpStatus(result.error.status));
      }
      return c.json({
        data: await presentSubmissionImages(container.mediaUrlResolver, result.value),
      });
    },
  );

  return r;
}
