import {
  AdminArtworkConsignorSchema,
  type AdminArtworkConsignorSetBody,
  AdminArtworkConsignorSetBodySchema,
  AdminConsignorAgreementConflictSchema,
  AdminConsignorAgreementValidationSchema,
  AdminRegisterParamsSchema,
  ShopApiErrorBodySchema,
} from "@auction/shop-contracts";
import type { FastifyInstance } from "fastify";
import type { AdminRoutesDeps } from "../../../admin-route-deps.js";
import { notFound } from "../../../errors/shop-api-error.js";
import { requireIdempotencyKey } from "../../../plugins/require-idempotency-key.js";
import {
  requireRecentAuthentication,
  requireShopAdminSubject,
  requireShopStaffCapability,
} from "../../../plugins/shop-admin-auth.js";
import { consignorClientScope, requireClientPartyReadAccess } from "./admin-client-access.js";

const tags = ["shop-admin"];

/** A consignor and a 500-character reason, at up to four bytes a character. */
const WRITE_BODY_LIMIT = 4_096;

const READ_ERRORS = { 403: ShopApiErrorBodySchema, 404: ShopApiErrorBodySchema } as const;
const WRITE_ERRORS = {
  400: AdminConsignorAgreementValidationSchema,
  403: ShopApiErrorBodySchema,
  404: ShopApiErrorBodySchema,
  409: AdminConsignorAgreementConflictSchema,
} as const;

type Deps = Pick<AdminRoutesDeps, "artworkConsignors" | "staffReader" | "stepUpMaxAuthAgeSeconds">;

/**
 * The Consignor field on a From Zoho record in LAX Admin (ZI-5, decision pack 17 November 2026,
 * section 1, option B).
 *
 * - Reading: `artwork_register.read` for the record, and `consignor_agreement.read` for who
 *   consigned it and where and when their agreements apply. As on a client's page, someone who
 *   does not keep agreements reads a client consignor only when they can open that client, so a
 *   broker reads the works of the clients assigned to them. LAX, or no consignor, needs no client.
 * - Originals only: a print has no consignor, so reading it is a 404 and setting it a 409.
 * - Setting or changing: `consignor_agreement.manage` (Administrators and Catalogue editors), with
 *   a recent sign-in (`SHOP_ADMIN_STEP_UP_PATHS` lists the consignor path), an `Idempotency-Key`
 *   and the LAX Admin audit row in the same transaction as the change.
 */
export async function registerAdminArtworkConsignorRoutes(app: FastifyInstance, deps: Deps) {
  const service = deps.artworkConsignors;

  app.get(
    "/artwork-register/:registerId/consignor",
    {
      schema: {
        tags,
        params: AdminRegisterParamsSchema,
        response: { 200: AdminArtworkConsignorSchema, ...READ_ERRORS },
      },
    },
    async (request) => {
      requireShopStaffCapability(request, "artwork_register.read");
      const auth = requireShopStaffCapability(request, "consignor_agreement.read");
      const { registerId } = request.params as { registerId: string };
      const consignor = await service.get(registerId);
      if (!consignor) throw notFound("Artwork");
      const current = consignor.current?.consignor;
      if (current?.kind === "client" && consignorClientScope(auth) !== "all") {
        await requireClientPartyReadAccess(request, deps, current.partyId);
      }
      return consignor;
    },
  );

  app.put(
    "/artwork-register/:registerId/consignor",
    {
      bodyLimit: WRITE_BODY_LIMIT,
      schema: {
        tags,
        params: AdminRegisterParamsSchema,
        body: AdminArtworkConsignorSetBodySchema,
        response: { 200: AdminArtworkConsignorSchema, ...WRITE_ERRORS },
      },
    },
    async (request) => {
      requireShopStaffCapability(request, "consignor_agreement.manage");
      requireRecentAuthentication(request, deps.stepUpMaxAuthAgeSeconds);
      const { registerId } = request.params as { registerId: string };
      const body = request.body as AdminArtworkConsignorSetBody;
      return service.set({
        actorSubjectId: requireShopAdminSubject(request),
        idempotencyKey: requireIdempotencyKey(request),
        registerId,
        consignor: body.consignor,
        reason: body.reason,
        expectedCurrentId: body.expectedCurrentId,
      });
    },
  );
}
