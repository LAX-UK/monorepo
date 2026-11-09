import {
  AdminDeclineDeliveryQuoteBodySchema,
  type AdminDeliveryQuote,
  AdminDeliveryQuoteListSchema,
  AdminDeliveryQuoteParamsSchema,
  AdminDeliveryQuoteRejectedBodySchema,
  AdminDeliveryQuoteViewSchema,
  AdminSendDeliveryQuoteBodySchema,
  ShopApiErrorBodySchema,
} from "@auction/shop-contracts";
import { DELIVERY_QUOTES_WRITE_CAPABILITY } from "@auction/shop-domain";
import { Type } from "@sinclair/typebox";
import type { FastifyInstance } from "fastify";
import type { AdminRoutesDeps } from "../../../admin-route-deps.js";
import type {
  DeliveryQuoteStaffRow,
  DeliveryQuoteView,
} from "../../../application/delivery-quote-staff/delivery-quote-staff.ports.js";
import { countryNameOf } from "../../../infrastructure/delivery-quote-staff/drizzle-delivery-quote-staff.store.js";
import { requireIdempotencyKey } from "../../../plugins/require-idempotency-key.js";
import {
  requireShopAdminSubject,
  requireShopStaffCapability,
} from "../../../plugins/shop-admin-auth.js";

const REGION_NAMES = {
  eu: "European Union",
  north_america: "North America",
  asia_pacific: "Asia Pacific",
} as const;

function present(row: DeliveryQuoteStaffRow): AdminDeliveryQuote {
  return {
    id: row.id,
    orderId: row.orderId,
    orderReference: row.orderReference,
    status: row.status,
    country: row.country,
    countryName: countryNameOf(row.country),
    regionName: row.regionId ? REGION_NAMES[row.regionId] : null,
    recipientName: row.recipientName,
    address: row.address,
    phone: row.phone,
    items: row.items,
    merchandisePence: row.merchandisePence,
    requestedAt: row.requestedAt.toISOString(),
    holdUntil: row.holdUntil.toISOString(),
    quote: row.quote
      ? {
          pricePence: row.quote.pricePence,
          carrier: row.quote.carrier,
          service: row.quote.service,
          leadTimeNote: row.quote.leadTimeNote,
          quotedAt: row.quote.quotedAt.toISOString(),
        }
      : null,
    endReason: row.endReason,
    declineNote: row.declineNote,
  };
}

/**
 * LAX Admin › Orders › Delivery quotes. Every staff member who can open orders reads the list;
 * sending a price and carrier, or turning a request down, needs `order.write`.
 */
export async function registerAdminDeliveryQuoteRoutes(
  app: FastifyInstance,
  deps: Pick<AdminRoutesDeps, "deliveryQuotes" | "exportPaymentEnabled">,
) {
  app.get(
    "/orders/delivery-quotes",
    {
      schema: {
        tags: ["shop-admin"],
        querystring: Type.Object({ view: Type.Optional(AdminDeliveryQuoteViewSchema) }),
        response: { 200: AdminDeliveryQuoteListSchema, 403: ShopApiErrorBodySchema },
      },
    },
    async (request) => {
      requireShopStaffCapability(request, "order.read");
      const { view } = request.query as { view?: DeliveryQuoteView };
      const { items, waitingCount } = await deps.deliveryQuotes.list(view ?? "waiting");
      return {
        items: items.map(present),
        waitingCount,
        paymentOpen: deps.exportPaymentEnabled,
      };
    },
  );

  app.put(
    "/orders/delivery-quotes/:quoteId/quote",
    {
      schema: {
        tags: ["shop-admin"],
        params: AdminDeliveryQuoteParamsSchema,
        body: AdminSendDeliveryQuoteBodySchema,
        response: {
          204: Type.Null(),
          400: AdminDeliveryQuoteRejectedBodySchema,
          403: ShopApiErrorBodySchema,
          404: ShopApiErrorBodySchema,
          409: ShopApiErrorBodySchema,
        },
      },
    },
    async (request, reply) => {
      requireShopStaffCapability(request, DELIVERY_QUOTES_WRITE_CAPABILITY);
      const { quoteId } = request.params as { quoteId: string };
      const body = request.body as {
        pricePence: number;
        carrier: string;
        service?: string;
        leadTimeNote?: string;
      };
      await deps.deliveryQuotes.sendQuote({
        quoteId,
        pricePence: body.pricePence,
        carrier: body.carrier,
        service: body.service,
        leadTimeNote: body.leadTimeNote,
        actorSubjectId: requireShopAdminSubject(request),
        idempotencyKey: requireIdempotencyKey(request),
      });
      return reply.status(204).send();
    },
  );

  app.post(
    "/orders/delivery-quotes/:quoteId/decline",
    {
      schema: {
        tags: ["shop-admin"],
        params: AdminDeliveryQuoteParamsSchema,
        body: AdminDeclineDeliveryQuoteBodySchema,
        response: {
          204: Type.Null(),
          400: AdminDeliveryQuoteRejectedBodySchema,
          403: ShopApiErrorBodySchema,
          404: ShopApiErrorBodySchema,
          409: ShopApiErrorBodySchema,
        },
      },
    },
    async (request, reply) => {
      requireShopStaffCapability(request, DELIVERY_QUOTES_WRITE_CAPABILITY);
      const { quoteId } = request.params as { quoteId: string };
      const body = request.body as { note: string };
      await deps.deliveryQuotes.decline({
        quoteId,
        note: body.note,
        actorSubjectId: requireShopAdminSubject(request),
        idempotencyKey: requireIdempotencyKey(request),
      });
      return reply.status(204).send();
    },
  );
}
