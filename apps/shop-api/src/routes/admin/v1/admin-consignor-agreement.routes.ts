import {
  AdminConsignorAgreementConflictSchema,
  type AdminConsignorAgreementCreateBody,
  AdminConsignorAgreementCreateBodySchema,
  AdminConsignorAgreementFileLinkSchema,
  type AdminConsignorAgreementFileUploadBody,
  AdminConsignorAgreementFileUploadBodySchema,
  AdminConsignorAgreementFileUploadSchema,
  AdminConsignorAgreementListSchema,
  type AdminConsignorAgreementParams,
  AdminConsignorAgreementParamsSchema,
  AdminConsignorAgreementPartyParamsSchema,
  type AdminConsignorAgreementReplaceBody,
  AdminConsignorAgreementReplaceBodySchema,
  type AdminConsignorAgreementRetireBody,
  AdminConsignorAgreementRetireBodySchema,
  AdminConsignorAgreementSchema,
  AdminConsignorAgreementValidationSchema,
  type AdminConsignorAgreementVersionParams,
  AdminConsignorAgreementVersionParamsSchema,
  ShopApiErrorBodySchema,
} from "@auction/shop-contracts";
import type { ShopStaffCapability } from "@auction/shop-domain";
import type { FastifyInstance, FastifyRequest } from "fastify";
import type { AdminRoutesDeps } from "../../../admin-route-deps.js";
import { notFound } from "../../../errors/shop-api-error.js";
import { requireIdempotencyKey } from "../../../plugins/require-idempotency-key.js";
import {
  requireRecentAuthentication,
  requireShopAdminSubject,
  requireShopStaffCapability,
} from "../../../plugins/shop-admin-auth.js";
import { requireClientPartyReadAccess } from "./admin-client-access.js";

const tags = ["shop-admin"];

/** Terms, a file key and a 1000-character note, at up to four bytes a character. */
const WRITE_BODY_LIMIT = 8_192;

const READ_ERRORS = { 403: ShopApiErrorBodySchema, 404: ShopApiErrorBodySchema } as const;
/** A 400 from the service names each field at fault (`issues`); a stale 409 says the version. */
const WRITE_ERRORS = {
  400: AdminConsignorAgreementValidationSchema,
  403: ShopApiErrorBodySchema,
  404: ShopApiErrorBodySchema,
  409: AdminConsignorAgreementConflictSchema,
  503: ShopApiErrorBodySchema,
} as const;

type Deps = Pick<
  AdminRoutesDeps,
  "consignorAgreements" | "staffReader" | "stepUpMaxAuthAgeSeconds"
>;

/**
 * Consignor agreements on a client's page in LAX Admin (ZI-5, decision pack 17 November 2026,
 * section 1, option B).
 *
 * - Reading: `consignor_agreement.read`, which comes with reading clients. A broker reads the
 *   agreements of the clients assigned to them only, as for the client's page.
 * - Adding, replacing and retiring: `consignor_agreement.manage` (Administrators and Catalogue
 *   editors), with a recent sign-in (`SHOP_ADMIN_STEP_UP_PATHS` lists the agreements path).
 *   People who keep agreements work for any consignor, so the client scope does not apply to them.
 * - Uploading the signed file: `consignor_agreement.manage`. The upload alone changes nothing; the
 *   add or replace that names it needs the recent sign-in.
 *
 * Every write takes an `Idempotency-Key` and writes its LAX Admin audit row in the same
 * transaction as the change.
 */
export async function registerAdminConsignorAgreementRoutes(app: FastifyInstance, deps: Deps) {
  const service = deps.consignorAgreements;

  /** The capability, then the client: everyone but agreement keepers reads only clients they can open. */
  async function requireAccess(
    request: FastifyRequest,
    partyId: string,
    capability: ShopStaffCapability,
  ) {
    const auth = requireShopStaffCapability(request, capability);
    if (auth.capabilities.has("consignor_agreement.manage")) return;
    await requireClientPartyReadAccess(request, deps, partyId);
  }

  /** Who is writing, and the key that makes a retry safe. */
  const actorOf = (request: FastifyRequest) => ({
    actorSubjectId: requireShopAdminSubject(request),
    idempotencyKey: requireIdempotencyKey(request),
  });

  app.get(
    "/clients/:partyId/consignor-agreements",
    {
      schema: {
        tags,
        params: AdminConsignorAgreementPartyParamsSchema,
        response: { 200: AdminConsignorAgreementListSchema, ...READ_ERRORS },
      },
    },
    async (request) => {
      const { partyId } = request.params as { partyId: string };
      await requireAccess(request, partyId, "consignor_agreement.read");
      const list = await service.list(partyId);
      if (!list) throw notFound("Client not found");
      return list;
    },
  );

  app.get(
    "/clients/:partyId/consignor-agreements/versions/:versionId/file",
    {
      schema: {
        tags,
        params: AdminConsignorAgreementVersionParamsSchema,
        response: {
          200: AdminConsignorAgreementFileLinkSchema,
          ...READ_ERRORS,
          503: ShopApiErrorBodySchema,
        },
      },
    },
    async (request) => {
      const { partyId, versionId } = request.params as AdminConsignorAgreementVersionParams;
      await requireAccess(request, partyId, "consignor_agreement.read");
      return service.fileLink({ partyId, versionId });
    },
  );

  app.post(
    "/clients/:partyId/consignor-agreement-uploads",
    {
      schema: {
        tags,
        params: AdminConsignorAgreementPartyParamsSchema,
        body: AdminConsignorAgreementFileUploadBodySchema,
        response: { 200: AdminConsignorAgreementFileUploadSchema, ...WRITE_ERRORS },
      },
    },
    async (request) => {
      const { partyId } = request.params as { partyId: string };
      await requireAccess(request, partyId, "consignor_agreement.manage");
      requireShopAdminSubject(request);
      const body = request.body as AdminConsignorAgreementFileUploadBody;
      return service.createFileUpload({
        partyId,
        contentType: body.contentType,
        byteSize: body.byteSize,
      });
    },
  );

  app.post(
    "/clients/:partyId/consignor-agreements",
    {
      bodyLimit: WRITE_BODY_LIMIT,
      schema: {
        tags,
        params: AdminConsignorAgreementPartyParamsSchema,
        body: AdminConsignorAgreementCreateBodySchema,
        response: { 200: AdminConsignorAgreementSchema, ...WRITE_ERRORS },
      },
    },
    async (request) => {
      const { partyId } = request.params as { partyId: string };
      await requireAccess(request, partyId, "consignor_agreement.manage");
      requireRecentAuthentication(request, deps.stepUpMaxAuthAgeSeconds);
      const body = request.body as AdminConsignorAgreementCreateBody;
      return service.add({ ...actorOf(request), partyId, terms: body });
    },
  );

  app.post(
    "/clients/:partyId/consignor-agreements/:agreementId/replace",
    {
      bodyLimit: WRITE_BODY_LIMIT,
      schema: {
        tags,
        params: AdminConsignorAgreementParamsSchema,
        body: AdminConsignorAgreementReplaceBodySchema,
        response: { 200: AdminConsignorAgreementSchema, ...WRITE_ERRORS },
      },
    },
    async (request) => {
      const { partyId, agreementId } = request.params as AdminConsignorAgreementParams;
      await requireAccess(request, partyId, "consignor_agreement.manage");
      requireRecentAuthentication(request, deps.stepUpMaxAuthAgeSeconds);
      const { expectedVersion, ...terms } = request.body as AdminConsignorAgreementReplaceBody;
      return service.replace({ ...actorOf(request), partyId, agreementId, expectedVersion, terms });
    },
  );

  app.post(
    "/clients/:partyId/consignor-agreements/:agreementId/retire",
    {
      schema: {
        tags,
        params: AdminConsignorAgreementParamsSchema,
        body: AdminConsignorAgreementRetireBodySchema,
        response: { 200: AdminConsignorAgreementSchema, ...WRITE_ERRORS },
      },
    },
    async (request) => {
      const { partyId, agreementId } = request.params as AdminConsignorAgreementParams;
      await requireAccess(request, partyId, "consignor_agreement.manage");
      requireRecentAuthentication(request, deps.stepUpMaxAuthAgeSeconds);
      const { expectedVersion } = request.body as AdminConsignorAgreementRetireBody;
      return service.retire({ ...actorOf(request), partyId, agreementId, expectedVersion });
    },
  );
}
