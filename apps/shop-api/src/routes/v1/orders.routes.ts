import { randomUUID } from "node:crypto";
import {
  CheckoutSessionSchema,
  type OrderProblemReportRequest,
  OrderProblemReportRequestSchema,
  OrderProblemReportResponseSchema,
  OrderStatusSchema,
  OrderSummarySchema,
  SavedDeliveryAddressListSchema,
  ShopApiErrorBodySchema,
  ShopFulfilmentOptionSchema,
} from "@auction/shop-contracts";
import { orderProblemWindow } from "@auction/shop-domain";
import { Type } from "@sinclair/typebox";
import type { Static } from "@sinclair/typebox";
import type { FastifyInstance } from "fastify";

type ShopFulfilmentOption = Static<typeof ShopFulfilmentOptionSchema>;
import { SHOP_API_ERROR_CODES } from "@auction/shop-contracts";
import {
  decodeCatalogueCursor,
  encodeCatalogueCursor,
} from "../../application/catalogue-cursor.js";
import { buildOrderInvoiceModel, renderOrderInvoicePdf } from "../../application/order-invoice.js";
import { DEFAULT_ORDER_LIST_LIMIT } from "../../application/ports/commerce.ports.js";
import type { CommerceRoutesDeps } from "../../commerce-route-deps.js";
import { ShopApiError, notFound } from "../../errors/shop-api-error.js";
import { requireShopScope, requireShopSubject } from "../../plugins/shop-auth.js";
import { presentCheckoutSession, presentOrder } from "../../presenters/commerce.presenter.js";
import { admitEnquiry } from "./enquiry-admission.js";

const OrderListQuerySchema = Type.Object({
  limit: Type.Optional(
    Type.Integer({ minimum: 1, maximum: 50, default: DEFAULT_ORDER_LIST_LIMIT }),
  ),
  cursor: Type.Optional(Type.String()),
});

const OrderListSchema = Type.Object({
  items: Type.Array(OrderSummarySchema),
  nextCursor: Type.Optional(Type.String()),
});

/** JSON body rather than 204: the Shop Identity proxy re-serialises every upstream response. */
const OrderCancelledSchema = Type.Object({
  orderId: Type.String({ format: "uuid" }),
  status: OrderStatusSchema,
});

export async function registerOrderRoutes(app: FastifyInstance, deps: CommerceRoutesDeps) {
  app.get(
    "/v1/orders",
    {
      schema: {
        tags: ["commerce"],
        querystring: OrderListQuerySchema,
        response: { 200: OrderListSchema },
      },
    },
    async (request) => {
      requireShopScope(request, "shop.read");
      const subject = requireShopSubject(request);
      const query = request.query as { limit?: number; cursor?: string };
      const result = await deps.listOrders(subject, {
        limit: query.limit ?? DEFAULT_ORDER_LIST_LIMIT,
        cursor: decodeCatalogueCursor(query.cursor),
      });
      return {
        items: result.items.map((order) => presentOrder(order)),
        ...(result.nextCursor ? { nextCursor: encodeCatalogueCursor(result.nextCursor) } : {}),
      };
    },
  );

  app.get(
    "/v1/orders/:orderId",
    {
      schema: {
        tags: ["commerce"],
        params: Type.Object({ orderId: Type.String({ format: "uuid" }) }),
        response: { 200: OrderSummarySchema, 404: ShopApiErrorBodySchema },
      },
    },
    async (request) => {
      requireShopScope(request, "shop.read");
      const subject = requireShopSubject(request);
      const { orderId } = request.params as { orderId: string };
      const order = await deps.getOrder(subject, orderId);
      if (!order) {
        throw notFound("Order");
      }
      return presentOrder(order);
    },
  );

  app.get(
    "/v1/orders/:orderId/invoice",
    {
      schema: {
        tags: ["commerce"],
        params: Type.Object({ orderId: Type.String({ format: "uuid" }) }),
        response: { 404: ShopApiErrorBodySchema },
      },
    },
    async (request, reply) => {
      requireShopScope(request, "shop.read");
      const subject = requireShopSubject(request);
      const { orderId } = request.params as { orderId: string };
      const order = await deps.getOrder(subject, orderId);
      // An unpaid order has no invoice; it answers as if it did not exist.
      if (!order?.paidAt || !order.invoiceNumber) throw notFound("Invoice");
      const model = buildOrderInvoiceModel({
        order,
        customer: await deps.getCustomerProfile(subject),
        supplier: deps.invoiceIssuer.supplier,
        vatNumber: deps.invoiceIssuer.vatNumber,
      });
      const pdf = await renderOrderInvoicePdf(model);
      return reply
        .header("content-type", "application/pdf")
        .header("content-disposition", `attachment; filename="${model.fileName}"`)
        .header("cache-control", "private, no-store")
        .send(pdf);
    },
  );

  app.post(
    "/v1/orders/:orderId/problem-reports",
    {
      schema: {
        tags: ["commerce"],
        params: Type.Object({ orderId: Type.String({ format: "uuid" }) }),
        body: OrderProblemReportRequestSchema,
        response: {
          201: OrderProblemReportResponseSchema,
          400: ShopApiErrorBodySchema,
          403: ShopApiErrorBodySchema,
          404: ShopApiErrorBodySchema,
          409: ShopApiErrorBodySchema,
          429: ShopApiErrorBodySchema,
          503: ShopApiErrorBodySchema,
        },
      },
    },
    async (request, reply) => {
      requireShopScope(request, "shop.write");
      const subject = requireShopSubject(request);
      const problems = deps.orderProblems;
      if (!problems) {
        throw new ShopApiError(
          SHOP_API_ERROR_CODES.FEATURE_DISABLED,
          "Problem reports are not available",
          503,
        );
      }
      const { orderId } = request.params as { orderId: string };
      const body = request.body as OrderProblemReportRequest;
      const details = body.details.trim();
      if (!details) {
        throw new ShopApiError(SHOP_API_ERROR_CODES.VALIDATION, "Tell us what happened", 400);
      }
      const order = await deps.getOrder(subject, orderId);
      if (!order) throw notFound("Order");
      const window = orderProblemWindow({
        status: order.status,
        paidAt: order.paidAt,
        refundPeriodEndsAt: order.refundPeriodEndsAt,
        possessionAt: order.progress?.possessionAt ?? null,
        now: new Date(),
      });
      if (!window.open) {
        throw new ShopApiError(
          SHOP_API_ERROR_CODES.CONFLICT,
          "This order can no longer be reported here",
          409,
        );
      }
      const admission = await admitEnquiry(request, reply, problems.rateLimiter, {});
      if (admission.kind === "honeypot") {
        return reply.status(201).send({ reportId: randomUUID() });
      }
      const result = await problems.writer.submit({
        sender: admission.sender,
        orderReference: order.reference,
        reason: body.reason,
        details,
      });
      return reply.status(201).send(result);
    },
  );

  app.post(
    "/v1/orders/checkout",
    {
      schema: {
        tags: ["commerce"],
        body: Type.Object({
          basketId: Type.String({ format: "uuid" }),
          fulfilment: ShopFulfilmentOptionSchema,
          idempotencyKey: Type.String({ minLength: 8, maxLength: 128 }),
          successUrl: Type.String({ minLength: 1 }),
          cancelUrl: Type.String({ minLength: 1 }),
          deliveryAddress: Type.Optional(
            Type.Object({
              recipientName: Type.Optional(Type.String({ minLength: 1, maxLength: 200 })),
              line1: Type.String({ minLength: 1 }),
              line2: Type.Optional(Type.String()),
              city: Type.String({ minLength: 1 }),
              postcode: Type.String({ minLength: 1 }),
              country: Type.String({ minLength: 2, maxLength: 2 }),
            }),
          ),
          deliveryPhone: Type.Optional(
            Type.String({
              minLength: 8,
              maxLength: 20,
              pattern: "^\\+?[0-9][0-9 ()-]{6,19}$",
            }),
          ),
          /** Also add the delivery address to the shopper's LAX Account address book. */
          saveAddress: Type.Optional(Type.Boolean()),
        }),
        response: {
          200: CheckoutSessionSchema,
          400: ShopApiErrorBodySchema,
          409: ShopApiErrorBodySchema,
        },
      },
    },
    async (request) => {
      requireShopScope(request, "shop.write");
      const subject = requireShopSubject(request);
      const body = request.body as {
        basketId: string;
        fulfilment: ShopFulfilmentOption;
        idempotencyKey: string;
        successUrl: string;
        cancelUrl: string;
        deliveryAddress?: {
          recipientName?: string;
          line1: string;
          line2?: string;
          city: string;
          postcode: string;
          country: string;
        };
        deliveryPhone?: string;
        saveAddress?: boolean;
      };
      const deliveryPhone = body.deliveryPhone?.trim();
      if (body.deliveryAddress && !deliveryPhone) {
        throw new ShopApiError(
          SHOP_API_ERROR_CODES.VALIDATION,
          "Delivery phone is required with a delivery address",
          400,
        );
      }
      const session = await deps.checkoutOrder({
        subject,
        basketId: body.basketId,
        fulfilment: body.fulfilment,
        idempotencyKey: body.idempotencyKey,
        successUrl: body.successUrl,
        cancelUrl: body.cancelUrl,
        ...(deliveryPhone ? { deliveryPhone } : {}),
        ...(body.deliveryAddress ? { deliveryAddress: body.deliveryAddress } : {}),
      });
      const address = body.deliveryAddress;
      const recipientName = address?.recipientName?.trim();
      if (body.saveAddress && address && recipientName && deps.savedAddresses) {
        // After the order exists, so the address book can never hold up or fail a payment.
        await deps.savedAddresses.save(
          subject,
          {
            recipientName,
            line1: address.line1.trim(),
            line2: address.line2?.trim() || null,
            city: address.city.trim(),
            postcode: address.postcode.trim(),
            country: address.country.trim().toUpperCase(),
            phone: deliveryPhone ?? null,
          },
          (error) => request.log.warn({ err: error }, "shop_checkout_address_save_failed"),
        );
      }
      return presentCheckoutSession(session);
    },
  );

  app.get(
    "/v1/me/addresses",
    {
      schema: {
        tags: ["commerce"],
        response: { 200: SavedDeliveryAddressListSchema },
      },
    },
    async (request) => {
      requireShopScope(request, "shop.read");
      const subject = requireShopSubject(request);
      if (!deps.savedAddresses) return { available: false, addresses: [] };
      return deps.savedAddresses.list(subject, (error) =>
        request.log.warn({ err: error }, "shop_saved_addresses_unavailable"),
      );
    },
  );

  app.post(
    "/v1/orders/:orderId/resume-checkout",
    {
      schema: {
        tags: ["commerce"],
        params: Type.Object({ orderId: Type.String({ format: "uuid" }) }),
        body: Type.Object({
          successUrl: Type.String({ minLength: 1 }),
          cancelUrl: Type.String({ minLength: 1 }),
        }),
        response: {
          200: CheckoutSessionSchema,
          403: ShopApiErrorBodySchema,
          404: ShopApiErrorBodySchema,
          409: ShopApiErrorBodySchema,
        },
      },
    },
    async (request) => {
      requireShopScope(request, "shop.write");
      const subject = requireShopSubject(request);
      const { orderId } = request.params as { orderId: string };
      const body = request.body as { successUrl: string; cancelUrl: string };
      const session = await deps.resumeCheckoutOrder({
        subject,
        orderId,
        successUrl: body.successUrl,
        cancelUrl: body.cancelUrl,
      });
      return presentCheckoutSession(session);
    },
  );

  app.post(
    "/v1/orders/:orderId/cancel",
    {
      schema: {
        tags: ["commerce"],
        params: Type.Object({ orderId: Type.String({ format: "uuid" }) }),
        response: {
          200: OrderCancelledSchema,
          403: ShopApiErrorBodySchema,
          404: ShopApiErrorBodySchema,
        },
      },
    },
    async (request) => {
      requireShopScope(request, "shop.write");
      const subject = requireShopSubject(request);
      const { orderId } = request.params as { orderId: string };
      await deps.cancelCheckoutOrder({ subject, orderId });
      const order = await deps.getOrder(subject, orderId);
      if (!order) {
        throw new ShopApiError(SHOP_API_ERROR_CODES.NOT_FOUND, "Order not found", 404);
      }
      return { orderId, status: order.status };
    },
  );
}
