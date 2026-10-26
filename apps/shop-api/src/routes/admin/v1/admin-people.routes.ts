import {
  ADMIN_STAFF_REVOKE_REASON_MIN_LENGTH,
  type AdminStaffRevokeBody,
  AdminStaffRevokeBodySchema,
  SALE_AUTHORITY_NOTE_MAX_LENGTH,
  SHOP_API_ERROR_CODES,
  ShopApiErrorBodySchema,
} from "@auction/shop-contracts";
import { Type } from "@sinclair/typebox";
import type { FastifyInstance } from "fastify";
import type { AdminRoutesDeps } from "../../../admin-route-deps.js";
import { ShopApiError } from "../../../errors/shop-api-error.js";
import { requireIdempotencyKey } from "../../../plugins/require-idempotency-key.js";
import {
  requireRecentAuthentication,
  requireShopAdminSubject,
  requireShopStaffCapability,
} from "../../../plugins/shop-admin-auth.js";

const SaleAuthorityDecisionBodySchema = Type.Object({
  decision: Type.Union([Type.Literal("approve"), Type.Literal("decline")]),
  authorisedCount: Type.Optional(Type.Integer({ minimum: 0, maximum: 10 })),
  evidenceNote: Type.Optional(
    Type.String({ minLength: 1, maxLength: SALE_AUTHORITY_NOTE_MAX_LENGTH }),
  ),
  declineReason: Type.Optional(
    Type.String({ minLength: 1, maxLength: SALE_AUTHORITY_NOTE_MAX_LENGTH }),
  ),
});

const SaleAuthorityDecisionResponseSchema = Type.Object({
  requestId: Type.String({ format: "uuid" }),
  status: Type.String(),
});

const StaffGrantRoleSchema = Type.Union([
  Type.Literal("shop_admin"),
  Type.Literal("account_manager"),
  Type.Literal("broker"),
  Type.Literal("operations"),
  Type.Literal("finance"),
  Type.Literal("catalogue_editor"),
]);

const StaffGrantBodySchema = Type.Union([
  Type.Object(
    { identitySubjectId: Type.String({ minLength: 1 }), role: StaffGrantRoleSchema },
    { additionalProperties: false },
  ),
  Type.Object(
    { email: Type.String({ format: "email", maxLength: 320 }), role: StaffGrantRoleSchema },
    { additionalProperties: false },
  ),
]);

const StaffGrantResponseSchema = Type.Object({
  identitySubjectId: Type.String(),
  role: Type.String(),
  status: Type.Literal("active"),
});

export async function registerAdminPeopleRoutes(app: FastifyInstance, deps: AdminRoutesDeps) {
  app.post(
    "/sale-authority-requests/:requestId/decision",
    {
      // A note of the maximum length does not fit the 1 KB default.
      bodyLimit: 8_192,
      schema: {
        tags: ["shop-admin"],
        params: Type.Object({ requestId: Type.String({ format: "uuid" }) }),
        body: SaleAuthorityDecisionBodySchema,
        response: {
          200: SaleAuthorityDecisionResponseSchema,
          400: ShopApiErrorBodySchema,
          403: ShopApiErrorBodySchema,
          404: ShopApiErrorBodySchema,
          409: ShopApiErrorBodySchema,
        },
      },
    },
    async (request) => {
      requireShopStaffCapability(request, "sale_authority.write");
      requireRecentAuthentication(request, deps.stepUpMaxAuthAgeSeconds);
      const subject = requireShopAdminSubject(request);
      const { requestId } = request.params as { requestId: string };
      const body = request.body as {
        decision: "approve" | "decline";
        authorisedCount?: number;
        evidenceNote?: string;
        declineReason?: string;
      };
      const idempotencyKey = requireIdempotencyKey(request);
      if (body.decision === "decline") {
        // The seller is shown the reason, so a decline always carries one.
        const reason = body.declineReason?.trim();
        if (!reason) {
          throw new ShopApiError(
            SHOP_API_ERROR_CODES.VALIDATION,
            "A decline needs a reason the seller can read",
            400,
          );
        }
        return deps.rejectSaleAuthorityRequest({
          requestId,
          reason,
          operatorSubjectId: subject,
          idempotencyKey,
        });
      }
      const requestRow = await deps.getSaleAuthorityRequest(requestId);
      const authorisedCount = body.authorisedCount ?? requestRow.requestedCount;
      await deps.grantSaleAuthority(
        {
          requestId,
          artworkId: requestRow.artworkId,
          ownerPartyId: requestRow.ownerPartyId,
          authorisedCount,
          evidenceNote: body.evidenceNote ?? "Approved from admin",
          recordedBySubjectId: subject,
        },
        { idempotencyKey, actorSubjectId: subject },
      );
      return { requestId, status: "approved" };
    },
  );

  app.post(
    "/staff/grants",
    {
      schema: {
        tags: ["shop-admin"],
        body: StaffGrantBodySchema,
        response: {
          200: StaffGrantResponseSchema,
          403: ShopApiErrorBodySchema,
          404: ShopApiErrorBodySchema,
          409: ShopApiErrorBodySchema,
        },
      },
    },
    async (request) => {
      requireShopStaffCapability(request, "settings.write");
      requireRecentAuthentication(request, deps.stepUpMaxAuthAgeSeconds);
      const subject = requireShopAdminSubject(request);
      const idempotencyKey = requireIdempotencyKey(request);
      const body = request.body as { role: import("@auction/shop-domain").ShopStaffRole } & (
        | { identitySubjectId: string }
        | { email: string }
      );
      const granted = await deps.grantStaffRole({
        ...("email" in body ? { email: body.email } : { subject: body.identitySubjectId }),
        role: body.role,
        operatorSubjectId: subject,
        idempotencyKey,
      });
      return {
        identitySubjectId: granted.subject,
        role: body.role,
        status: "active" as const,
      };
    },
  );

  app.delete(
    "/staff/grants/:identitySubjectId",
    {
      schema: {
        tags: ["shop-admin"],
        params: Type.Object({ identitySubjectId: Type.String({ minLength: 1 }) }),
        // Removing someone's access is audited with why it was removed.
        body: AdminStaffRevokeBodySchema,
        response: {
          204: Type.Null(),
          400: ShopApiErrorBodySchema,
          403: ShopApiErrorBodySchema,
          409: ShopApiErrorBodySchema,
        },
      },
    },
    async (request, reply) => {
      requireShopStaffCapability(request, "settings.write");
      requireRecentAuthentication(request, deps.stepUpMaxAuthAgeSeconds);
      const subject = requireShopAdminSubject(request);
      const idempotencyKey = requireIdempotencyKey(request);
      const { identitySubjectId } = request.params as { identitySubjectId: string };
      const reason = (request.body as AdminStaffRevokeBody).reason.trim();
      if (reason.length < ADMIN_STAFF_REVOKE_REASON_MIN_LENGTH) {
        throw new ShopApiError(
          SHOP_API_ERROR_CODES.VALIDATION,
          "Say why their access is being removed",
          400,
        );
      }
      await deps.revokeStaffRole({
        subject: identitySubjectId,
        reason,
        operatorSubjectId: subject,
        idempotencyKey,
      });
      return reply.status(204).send();
    },
  );
}
