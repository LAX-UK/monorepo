import { ShopApiErrorBodySchema } from "@auction/shop-contracts";
import { Type } from "@sinclair/typebox";
import type { FastifyInstance } from "fastify";
import type { AdminRoutesDeps } from "../../../admin-route-deps.js";
import { requireIdempotencyKey } from "../../../plugins/require-idempotency-key.js";
import {
  requireShopAdminSubject,
  requireShopStaffCapability,
} from "../../../plugins/shop-admin-auth.js";

const SaleAuthorityDecisionBodySchema = Type.Object({
  decision: Type.Union([Type.Literal("approve"), Type.Literal("decline")]),
  authorisedCount: Type.Optional(Type.Integer({ minimum: 0, maximum: 10 })),
  evidenceNote: Type.Optional(Type.String()),
  declineReason: Type.Optional(Type.String()),
});

const SaleAuthorityDecisionResponseSchema = Type.Object({
  requestId: Type.String({ format: "uuid" }),
  status: Type.String(),
});

const StaffGrantBodySchema = Type.Object({
  identitySubjectId: Type.String({ minLength: 1 }),
  role: Type.String({ minLength: 1 }),
});

const StaffGrantResponseSchema = Type.Object({
  identitySubjectId: Type.String(),
  role: Type.String(),
  status: Type.Literal("active"),
});

export async function registerAdminPeopleRoutes(app: FastifyInstance, deps: AdminRoutesDeps) {
  app.post(
    "/sale-authority-requests/:requestId/decision",
    {
      schema: {
        tags: ["shop-admin"],
        params: Type.Object({ requestId: Type.String({ format: "uuid" }) }),
        body: SaleAuthorityDecisionBodySchema,
        response: {
          200: SaleAuthorityDecisionResponseSchema,
          403: ShopApiErrorBodySchema,
          409: ShopApiErrorBodySchema,
        },
      },
    },
    async (request) => {
      requireShopStaffCapability(request, "sale_authority.write");
      const subject = requireShopAdminSubject(request);
      requireIdempotencyKey(request);
      const { requestId } = request.params as { requestId: string };
      const body = request.body as {
        decision: "approve" | "decline";
        authorisedCount?: number;
        evidenceNote?: string;
        declineReason?: string;
      };
      if (body.decision === "decline") {
        const result = await deps.rejectSaleAuthorityRequest({
          requestId,
          reason: body.declineReason ?? "Declined by staff",
          operatorSubjectId: subject,
        });
        return result;
      }
      const requestRow = await deps.getSaleAuthorityRequest(requestId);
      const authorisedCount = body.authorisedCount ?? requestRow.requestedCount;
      await deps.grantSaleAuthority({
        requestId,
        artworkId: requestRow.artworkId,
        ownerPartyId: requestRow.ownerPartyId,
        authorisedCount,
        evidenceNote: body.evidenceNote ?? "Approved from admin",
        recordedBySubjectId: subject,
      });
      return { requestId, status: "approved" };
    },
  );

  app.post(
    "/staff/grants",
    {
      schema: {
        tags: ["shop-admin"],
        body: StaffGrantBodySchema,
        response: { 200: StaffGrantResponseSchema, 403: ShopApiErrorBodySchema },
      },
    },
    async (request) => {
      requireShopStaffCapability(request, "settings.write");
      const subject = requireShopAdminSubject(request);
      requireIdempotencyKey(request);
      const body = request.body as { identitySubjectId: string; role: string };
      await deps.grantStaffRole({
        subject: body.identitySubjectId,
        role: body.role as import("@auction/shop-domain").ShopStaffRole,
        operatorSubjectId: subject,
      });
      return {
        identitySubjectId: body.identitySubjectId,
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
        response: { 204: Type.Null(), 403: ShopApiErrorBodySchema },
      },
    },
    async (request, reply) => {
      requireShopStaffCapability(request, "settings.write");
      const subject = requireShopAdminSubject(request);
      requireIdempotencyKey(request);
      const { identitySubjectId } = request.params as { identitySubjectId: string };
      await deps.revokeStaffRole({
        subject: identitySubjectId,
        operatorSubjectId: subject,
      });
      return reply.status(204).send();
    },
  );
}
