import {
  type AdminCertificateAuthorityBody,
  AdminCertificateAuthorityBodySchema,
  AdminCertificatesToSendSchema,
  type AdminConfirmPrintBody,
  AdminConfirmPrintBodySchema,
  AdminConfirmPrintResponseSchema,
  AdminHorsCommerceApprovalResponseSchema,
  AdminPickAndPackSchema,
  type AdminSwapPrintBody,
  AdminSwapPrintBodySchema,
  AdminSwapPrintResponseSchema,
  ShopApiErrorBodySchema,
} from "@auction/shop-contracts";
import { Type } from "@sinclair/typebox";
import type { FastifyInstance, FastifyRequest } from "fastify";
import type { AdminRoutesDeps } from "../../../admin-route-deps.js";
import { requireIdempotencyKey } from "../../../plugins/require-idempotency-key.js";
import {
  requireShopAdminSubject,
  requireShopStaffCapability,
  staffCan,
} from "../../../plugins/shop-admin-auth.js";

const IdParams = Type.Object({ id: Type.String({ format: "uuid" }) });
const OrderParams = Type.Object({ orderId: Type.String({ format: "uuid" }) });

const ERRORS = {
  400: ShopApiErrorBodySchema,
  403: ShopApiErrorBodySchema,
  404: ShopApiErrorBodySchema,
  409: ShopApiErrorBodySchema,
} as const;

function actor(request: FastifyRequest) {
  return {
    actorSubjectId: requireShopAdminSubject(request),
    idempotencyKey: requireIdempotencyKey(request),
  };
}

const idOf = (request: FastifyRequest) => (request.params as { id: string }).id;

/**
 * Packing in LAX Admin: an order's pick list, confirming the print in hand, sending another print
 * in its place, the certificates still to send, the artist's written authority behind them and
 * approving hors commerce proofs for sale. Thin: each route checks access and hands one command
 * to its use case.
 */
export async function registerAdminPrintFulfilmentRoutes(
  app: FastifyInstance,
  deps: Pick<AdminRoutesDeps, "printFulfilment">,
) {
  const { pickAndPack, confirm, swap, certificates } = deps.printFulfilment;

  app.get(
    "/orders/:orderId/pick-and-pack",
    {
      schema: {
        tags: ["shop-admin"],
        params: OrderParams,
        response: { 200: AdminPickAndPackSchema, ...ERRORS },
      },
    },
    async (request) => {
      requireShopStaffCapability(request, "order.read");
      return pickAndPack.forOrder((request.params as { orderId: string }).orderId);
    },
  );

  app.post(
    "/order-lines/:id/confirm-print",
    {
      schema: {
        tags: ["shop-admin"],
        params: IdParams,
        body: AdminConfirmPrintBodySchema,
        response: { 200: AdminConfirmPrintResponseSchema, ...ERRORS },
      },
    },
    async (request) => {
      requireShopStaffCapability(request, "fulfilment.write");
      return confirm.confirm({
        ...actor(request),
        orderLineId: idOf(request),
        scanned: request.body as AdminConfirmPrintBody,
      });
    },
  );

  app.post(
    "/order-lines/:id/swap-print",
    {
      schema: {
        tags: ["shop-admin"],
        params: IdParams,
        body: AdminSwapPrintBodySchema,
        response: { 200: AdminSwapPrintResponseSchema, ...ERRORS },
      },
    },
    async (request) => {
      const auth = requireShopStaffCapability(request, "fulfilment.write");
      const body = request.body as AdminSwapPrintBody;
      return swap.swap({
        ...actor(request),
        orderLineId: idOf(request),
        toEditionId: body.toEditionId,
        reason: body.reason,
        canSwapAcrossOwners: staffCan(auth, "print_swap.cross_owner"),
      });
    },
  );

  app.get(
    "/certificates/to-send",
    {
      schema: {
        tags: ["shop-admin"],
        response: { 200: AdminCertificatesToSendSchema, 403: ShopApiErrorBodySchema },
      },
    },
    async (request) => {
      requireShopStaffCapability(request, "fulfilment.write");
      return certificates.listToSend();
    },
  );

  app.post(
    "/certificates/:id/mark-sent",
    {
      schema: {
        tags: ["shop-admin"],
        params: IdParams,
        response: { 200: Type.Object({ issuedAt: Type.String() }), ...ERRORS },
      },
    },
    async (request) => {
      requireShopStaffCapability(request, "fulfilment.write");
      return certificates.markSent({ ...actor(request), certificateId: idOf(request) });
    },
  );

  app.put(
    "/artworks/:id/certificate-authority",
    {
      schema: {
        tags: ["shop-admin"],
        params: IdParams,
        body: AdminCertificateAuthorityBodySchema,
        response: { 200: Type.Object({ recordedAt: Type.String() }), ...ERRORS },
      },
    },
    async (request) => {
      requireShopStaffCapability(request, "catalogue.write");
      return certificates.recordAuthority({
        ...actor(request),
        artworkId: idOf(request),
        reference: (request.body as AdminCertificateAuthorityBody).reference,
      });
    },
  );

  app.post(
    "/artworks/:id/hors-commerce-approval",
    {
      schema: {
        tags: ["shop-admin"],
        params: IdParams,
        response: { 200: AdminHorsCommerceApprovalResponseSchema, ...ERRORS },
      },
    },
    async (request) => {
      requireShopStaffCapability(request, "hors_commerce.approve");
      return certificates.approveHorsCommerce({ ...actor(request), artworkId: idOf(request) });
    },
  );
}
