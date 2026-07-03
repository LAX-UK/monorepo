import {
  type CreateItemSubmissionInput,
  type UserRole,
  canAccessAdminSubmissionsRead,
  normalizeUserStaffRole,
  roleHasCapability,
} from "@auction/types";
import {
  attachSubmissionDocumentBodySchema,
  createItemSubmissionSchema,
  entityDocumentIdParamSchema,
  listSubmissionsQuerySchema,
  submissionIdParamSchema,
} from "@auction/validators";
import { asHttpStatus } from "../../lib/http-status.js";
import { zValidator } from "../../lib/z-validator.js";
import {
  requireBuyerRole,
  requireBuyerRoleUnlessStaff,
} from "../../middleware/require-buyer-role.js";
import type { LegalEntityContext } from "../../middleware/require-legal-entity-context.js";
import { EntityDocumentError } from "../../services/entity-document.service.js";
import type { SubmissionHono, SubmissionRouteDeps } from "./_shared.js";

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

export function attachSubmissionSellerRoutes(r: SubmissionHono, deps: SubmissionRouteDeps): void {
  const { container, requireAuth, requireSubmissionEntityContext } = deps;

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
      const result = await container.itemSubmissionSellerApi.createDraftForSellerApi(
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
      const { data, total } = await container.itemSubmissionSellerApi.listSubmissionsForSellerApi(
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
    const summary = await container.itemSubmissionSellerApi.getSubmissionSummaryForSellerApi(
      ctx.legalEntityId,
    );
    return c.json({ data: summary });
  });

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
      const result = await container.itemSubmissionSellerApi.getSubmissionForViewerApi({
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
      const owned = await container.itemSubmissionSellerApi.getForSeller(ctx.legalEntityId, id);
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
        const owned = await container.itemSubmissionSellerApi.getForSeller(ctx.legalEntityId, id);
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
        const owned = await container.itemSubmissionSellerApi.getForSeller(ctx.legalEntityId, id);
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
      const out = await container.itemSubmissionSellerApi.patchSubmissionFromRequestBody({
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
      const result = await container.itemSubmissionSellerApi.submitForReviewForSellerApi(
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
      const result = await container.itemSubmissionSellerApi.withdrawForSellerApi(
        ctx.legalEntityId,
        id,
      );
      if (result.isErr()) {
        return c.json({ error: result.error.message }, asHttpStatus(result.error.status));
      }
      return c.json({ data: result.value });
    },
  );
}
