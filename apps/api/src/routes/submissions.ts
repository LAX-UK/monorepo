import {
  type CreateItemSubmissionInput,
  type ItemSubmissionStatus,
  type UserRole,
  canAccessAdminSubmissionsRead,
  normalizeUserStaffRole,
  roleHasCapability,
} from "@auction/types";
import {
  adminAssignSubmissionBodySchema,
  adminBulkSubmissionsBodySchema,
  approveSubmissionBodySchema,
  attachSubmissionDocumentBodySchema,
  createItemSubmissionSchema,
  entityDocumentIdParamSchema,
  listSubmissionsQuerySchema,
  rejectSubmissionBodySchema,
  submissionIdParamSchema,
} from "@auction/validators";
import { Hono } from "hono";
import type { Container } from "../container.js";
import { asHttpStatus } from "../lib/http-status.js";
import { zValidator } from "../lib/z-validator.js";
import { createRequireAuth } from "../middleware/require-auth.js";
import { requireBuyerRole, requireBuyerRoleUnlessStaff } from "../middleware/require-buyer-role.js";
import { requirePlatformShell } from "../middleware/require-capability.js";
import type { LegalEntityContext } from "../middleware/require-legal-entity-context.js";
import { EntityDocumentError } from "../services/entity-document.service.js";
import type { IAuthenticator } from "../services/interfaces/authenticator.js";
import type { ListSubmissionsFilter } from "../services/interfaces/repositories.js";

function canStaffManageSubmissionDocuments(
  role: UserRole,
  staffRole: ReturnType<typeof normalizeUserStaffRole>,
): boolean {
  if (role !== "staff") return false;
  return (
    roleHasCapability(role, "specialist.appraise", staffRole) ||
    roleHasCapability(role, "catalogue.write", staffRole) ||
    roleHasCapability(role, "auction.manage", staffRole)
  );
}

function submissionsAdminListFilter(
  q: {
    queue?: "awaiting" | "accepted" | "rejected" | undefined;
    status?: ItemSubmissionStatus | undefined;
    sellerId?: string | undefined;
    categoryId?: string | undefined;
    q?: string | undefined;
    qualityGaps?: "1" | undefined;
    assignedTo?: "me" | undefined;
    sort?: "newest" | "oldest" | "sla" | undefined;
    limit: number;
    offset: number;
  },
  userId: string,
): ListSubmissionsFilter {
  const base: ListSubmissionsFilter = {
    limit: q.limit,
    offset: q.offset,
    ...(q.sellerId ? { legalEntityId: q.sellerId } : {}),
    ...(q.categoryId ? { categoryId: q.categoryId } : {}),
    ...(q.q ? { q: q.q.trim() || undefined } : {}),
    ...(q.qualityGaps === "1" ? { qualityGaps: true } : {}),
    ...(q.assignedTo === "me" ? { assignedToUserId: userId } : {}),
    ...(q.sort ? { sort: q.sort } : {}),
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
      const { data, total } = await container.itemSubmissionService.listSubmissionsForSellerApi(
        ctx.legalEntityId,
        {
          status: q.status,
          q: q.q,
          limit: q.limit,
          offset: q.offset,
        },
      );
      return c.json({ data, total });
    },
  );

  r.get("/mine/summary", requireAuth, requireSubmissionEntityContext, async (c) => {
    const ctx = c.get("legalEntityContext") as LegalEntityContext;
    const summary = await container.itemSubmissionService.getSubmissionSummaryForSellerApi(
      ctx.legalEntityId,
    );
    return c.json({ data: summary });
  });

  r.get(
    "/",
    requireAuth,
    requirePlatformShell,
    zValidator("query", listSubmissionsQuerySchema),
    async (c) => {
      const q = c.req.valid("query");
      const userId = c.get("userId") as string;
      const { data, total } = await container.itemSubmissionService.listSubmissionsForAdminApi(
        submissionsAdminListFilter(q, userId),
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

  r.get(
    "/:id/documents",
    requireAuth,
    requireBuyerRoleUnlessStaff,
    requireSubmissionEntityContext,
    zValidator("param", submissionIdParamSchema),
    async (c) => {
      const { id } = c.req.valid("param");
      const role = (c.get("userRole") ?? "client") as UserRole;
      const staff = normalizeUserStaffRole(c.get("userStaffRole") as string | null | undefined);
      if (canAccessAdminSubmissionsRead(role, staff)) {
        const data = await container.submissionDocumentService.list(id);
        return c.json({ data });
      }
      const ctx = c.get("legalEntityContext") as LegalEntityContext;
      const owned = await container.itemSubmissionService.getForSeller(ctx.legalEntityId, id);
      if (owned.isErr()) {
        return c.json({ error: owned.error.message }, asHttpStatus(owned.error.status));
      }
      const data = await container.submissionDocumentService.list(id);
      return c.json({ data });
    },
  );

  r.post(
    "/:id/documents",
    requireAuth,
    requireBuyerRoleUnlessStaff,
    requireSubmissionEntityContext,
    zValidator("param", submissionIdParamSchema),
    zValidator("json", attachSubmissionDocumentBodySchema),
    async (c) => {
      const { id } = c.req.valid("param");
      const body = c.req.valid("json");
      const userId = c.get("userId") as string;
      const role = (c.get("userRole") ?? "client") as UserRole;
      const staff = normalizeUserStaffRole(c.get("userStaffRole") as string | null | undefined);
      if (!canStaffManageSubmissionDocuments(role, staff)) {
        const ctx = c.get("legalEntityContext") as LegalEntityContext;
        const owned = await container.itemSubmissionService.getForSeller(ctx.legalEntityId, id);
        if (owned.isErr()) {
          return c.json({ error: owned.error.message }, asHttpStatus(owned.error.status));
        }
      }
      try {
        const doc = await container.submissionDocumentService.attach({
          entityId: id,
          kind: body.kind,
          label: body.label ?? null,
          uploadObjectId: body.uploadObjectId,
          userId,
        });
        return c.json({ data: doc }, 201);
      } catch (e) {
        if (e instanceof EntityDocumentError && e.code === "upload_not_active") {
          return c.json({ error: e.code }, 400);
        }
        throw e;
      }
    },
  );

  r.delete(
    "/:id/documents/:documentId",
    requireAuth,
    requireBuyerRoleUnlessStaff,
    requireSubmissionEntityContext,
    zValidator("param", submissionIdParamSchema.merge(entityDocumentIdParamSchema)),
    async (c) => {
      const { id, documentId } = c.req.valid("param");
      const role = (c.get("userRole") ?? "client") as UserRole;
      const staff = normalizeUserStaffRole(c.get("userStaffRole") as string | null | undefined);
      if (!canStaffManageSubmissionDocuments(role, staff)) {
        const ctx = c.get("legalEntityContext") as LegalEntityContext;
        const owned = await container.itemSubmissionService.getForSeller(ctx.legalEntityId, id);
        if (owned.isErr()) {
          return c.json({ error: owned.error.message }, asHttpStatus(owned.error.status));
        }
      }
      await container.submissionDocumentService.remove(id, documentId);
      return c.body(null, 204);
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
    requirePlatformShell,
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
    requirePlatformShell,
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
    "/:id/accept",
    requireAuth,
    requirePlatformShell,
    zValidator("param", submissionIdParamSchema),
    zValidator("json", approveSubmissionBodySchema),
    async (c) => {
      const adminId = c.get("userId") as string;
      const { id } = c.req.valid("param");
      const body = c.req.valid("json");
      const result = await container.itemSubmissionService.acceptForAdminApi(adminId, id, body);
      if (result.isErr()) {
        return c.json({ error: result.error.message }, asHttpStatus(result.error.status));
      }
      return c.json({ data: result.value });
    },
  );

  r.post(
    "/:id/convert",
    requireAuth,
    requirePlatformShell,
    zValidator("param", submissionIdParamSchema),
    zValidator("json", approveSubmissionBodySchema),
    async (c) => {
      const adminId = c.get("userId") as string;
      const { id } = c.req.valid("param");
      const body = c.req.valid("json");
      const result = await container.itemSubmissionService.convertForAdminApi(adminId, id, body);
      if (result.isErr()) {
        return c.json({ error: result.error.message }, asHttpStatus(result.error.status));
      }
      return c.json({ data: result.value });
    },
  );

  r.post(
    "/:id/assign",
    requireAuth,
    requirePlatformShell,
    zValidator("param", submissionIdParamSchema),
    zValidator("json", adminAssignSubmissionBodySchema),
    async (c) => {
      const adminId = c.get("userId") as string;
      const { id } = c.req.valid("param");
      const { assignedToUserId } = c.req.valid("json");
      const result = await container.itemSubmissionService.assignForAdminApi(
        adminId,
        id,
        assignedToUserId,
      );
      if (result.isErr()) {
        return c.json({ error: result.error.message }, asHttpStatus(result.error.status));
      }
      return c.json({ data: result.value });
    },
  );

  r.post(
    "/:id/approve",
    requireAuth,
    requirePlatformShell,
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
    requirePlatformShell,
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
