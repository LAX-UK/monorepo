import type { CreateItemSubmissionInput, ItemSubmissionStatus, UserRole } from "@auction/types";
import {
  adminBulkSubmissionsBodySchema,
  approveSubmissionBodySchema,
  createItemSubmissionSchema,
  listSubmissionsQuerySchema,
  rejectSubmissionBodySchema,
  submissionIdParamSchema,
} from "@auction/validators";
import { zValidator } from "@hono/zod-validator";
import { Hono } from "hono";
import type { Container } from "../container.js";
import { asHttpStatus } from "../lib/http-status.js";
import { createRequireAuth } from "../middleware/require-auth.js";
import { requireBuyerRole, requireBuyerRoleUnlessStaff } from "../middleware/require-buyer-role.js";
import { requirePlatformAdmin } from "../middleware/require-capability.js";
import type { LegalEntityContext } from "../middleware/require-legal-entity-context.js";
import type { IAuthenticator } from "../services/interfaces/authenticator.js";
import type { ListSubmissionsFilter } from "../services/interfaces/repositories.js";

function submissionsAdminListFilter(q: {
  queue?: "awaiting" | "accepted" | "rejected" | undefined;
  status?: ItemSubmissionStatus | undefined;
  sellerId?: string | undefined;
  categoryId?: string | undefined;
  q?: string | undefined;
  limit: number;
  offset: number;
}): ListSubmissionsFilter {
  const base: ListSubmissionsFilter = {
    limit: q.limit,
    offset: q.offset,
    ...(q.sellerId ? { legalEntityId: q.sellerId } : {}),
    ...(q.categoryId ? { categoryId: q.categoryId } : {}),
    ...(q.q ? { q: q.q.trim() || undefined } : {}),
  };
  const AWAITING: ItemSubmissionStatus[] = ["submitted", "under_review"];
  const ACCEPTED: ItemSubmissionStatus[] = ["approved", "converted"];
  switch (q.queue) {
    case "awaiting":
      return { ...base, statuses: AWAITING };
    case "accepted":
      return { ...base, statuses: ACCEPTED };
    case "rejected":
      return { ...base, statuses: ["rejected"] };
    default:
      return { ...base, ...(q.status !== undefined ? { status: q.status } : {}) };
  }
}

export function createSubmissionRoutes(container: Container, authenticator: IAuthenticator) {
  const requireAuth = createRequireAuth(authenticator, {
    isSuspended: (id) => container.userSuspensionChecker.isSuspended(id),
  });

  const requireSubmissionEntityContext = container.requireSubmissionsLegalEntityContext;
  const r = new Hono<{
    Variables: {
      userId?: string;
      userRole?: string;
      userStaffRole?: string | null;
      legalEntityContext?: LegalEntityContext;
    };
  }>();

  r.post(
    "/",
    requireAuth,
    requireBuyerRole,
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
      const result = await container.itemSubmissionService.createDraftForSellerApi(
        ctx.legalEntityId,
        input,
      );
      if (result.isErr())
        return c.json({ error: result.error.message }, asHttpStatus(result.error.status));
      return c.json({ data: result.value }, 201);
    },
  );

  r.get(
    "/mine",
    requireAuth,
    requireSubmissionEntityContext,
    zValidator("query", listSubmissionsQuerySchema),
    async (c) => {
      const ctx = c.get("legalEntityContext") as LegalEntityContext;
      const q = c.req.valid("query");
      const { data } = await container.itemSubmissionService.listSubmissionsForSellerApi(
        ctx.legalEntityId,
        {
          status: q.status,
          limit: q.limit,
          offset: q.offset,
        },
      );
      return c.json({ data });
    },
  );

  r.get(
    "/",
    requireAuth,
    requirePlatformAdmin,
    zValidator("query", listSubmissionsQuerySchema),
    async (c) => {
      const q = c.req.valid("query");
      const { data, total } = await container.itemSubmissionService.listSubmissionsForAdminApi(
        submissionsAdminListFilter(q),
      );
      return c.json({ data, total });
    },
  );

  r.get(
    "/:id",
    requireAuth,
    requireSubmissionEntityContext,
    zValidator("param", submissionIdParamSchema),
    async (c) => {
      const { id } = c.req.valid("param");
      const role = (c.get("userRole") ?? "client") as UserRole;
      const ctx = c.get("legalEntityContext") as LegalEntityContext;
      const staff = (c.get("userStaffRole") as string | null | undefined) ?? null;
      const result = await container.itemSubmissionService.getSubmissionForViewerApi({
        submissionId: id,
        role,
        staffRole: staff,
        sellerLegalEntityId: ctx.legalEntityId,
      });
      if (result.isErr()) {
        return c.json({ error: result.error.message }, asHttpStatus(result.error.status));
      }
      return c.json({ data: result.value });
    },
  );

  r.patch(
    "/:id",
    requireAuth,
    requireBuyerRoleUnlessStaff,
    requireSubmissionEntityContext,
    zValidator("param", submissionIdParamSchema),
    async (c) => {
      const { id } = c.req.valid("param");
      const role = (c.get("userRole") ?? "client") as UserRole;
      const userId = c.get("userId") as string;
      const ctx = c.get("legalEntityContext") as LegalEntityContext;
      let raw: unknown = {};
      try {
        raw = await c.req.json();
      } catch {
        raw = {};
      }
      const staff = (c.get("userStaffRole") as string | null | undefined) ?? null;
      const out = await container.itemSubmissionService.patchSubmissionFromRequestBody({
        rawBody: raw,
        submissionId: id,
        role,
        staffRole: staff,
        userId,
        sellerLegalEntityId: ctx.legalEntityId,
      });
      if (out.kind === "bad_request") {
        return c.json({ error: "Invalid body", details: out.details }, 400);
      }
      if (out.kind === "err") {
        return c.json({ error: out.error.message }, asHttpStatus(out.error.status));
      }
      return c.json({ data: out.data });
    },
  );

  r.post(
    "/:id/submit",
    requireAuth,
    requireBuyerRole,
    requireSubmissionEntityContext,
    zValidator("param", submissionIdParamSchema),
    async (c) => {
      const ctx = c.get("legalEntityContext") as LegalEntityContext;
      const { id } = c.req.valid("param");
      const result = await container.itemSubmissionService.submitForReviewForSellerApi(
        ctx.legalEntityId,
        id,
      );
      if (result.isErr()) {
        return c.json({ error: result.error.message }, asHttpStatus(result.error.status));
      }
      return c.json({ data: result.value });
    },
  );

  r.post(
    "/:id/withdraw",
    requireAuth,
    requireBuyerRole,
    requireSubmissionEntityContext,
    zValidator("param", submissionIdParamSchema),
    async (c) => {
      const ctx = c.get("legalEntityContext") as LegalEntityContext;
      const { id } = c.req.valid("param");
      const result = await container.itemSubmissionService.withdrawForSellerApi(
        ctx.legalEntityId,
        id,
      );
      if (result.isErr()) {
        return c.json({ error: result.error.message }, asHttpStatus(result.error.status));
      }
      return c.json({ data: result.value });
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
      const result = await container.itemSubmissionService.startReviewForAdminApi(adminId, id);
      if (result.isErr()) {
        return c.json({ error: result.error.message }, asHttpStatus(result.error.status));
      }
      return c.json({ data: result.value });
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
      const out = await container.itemSubmissionService.bulkApproveOrReject({
        adminId,
        ids,
        op,
        reason,
        reviewNotes,
      });
      if (out.kind === "bad_request") {
        return c.json({ error: out.message }, 400);
      }
      if (out.kind === "err") {
        return c.json({ error: out.error.message }, asHttpStatus(out.error.status));
      }
      return c.json({ ok: true, data: { count: out.count } });
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
      const body = c.req.valid("json");
      const result = await container.itemSubmissionService.approveForAdminApi(adminId, id, body);
      if (result.isErr()) {
        return c.json({ error: result.error.message }, asHttpStatus(result.error.status));
      }
      return c.json({ data: result.value });
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
      const result = await container.itemSubmissionService.rejectForAdminApi(
        adminId,
        id,
        rejectionReason,
        reviewNotes,
      );
      if (result.isErr()) {
        return c.json({ error: result.error.message }, asHttpStatus(result.error.status));
      }
      return c.json({ data: result.value });
    },
  );

  return r;
}
