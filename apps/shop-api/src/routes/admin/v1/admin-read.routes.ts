import {
  AdminArtistDetailSchema,
  AdminArtistListSchema,
  AdminClientDetailSchema,
  AdminFulfilmentListSchema,
  AdminMerchandiseProductListSchema,
  AdminOrderDetailSchema,
  AdminOrderListSchema,
  AdminOriginalSaleListSchema,
  AdminOverviewKpisSchema,
  AdminPartyListSchema,
  AdminPayoutListSchema,
  AdminProductionTaskListSchema,
  AdminSaleAuthorityRequestListSchema,
  AdminStaffMemberListSchema,
  AdminStockHoldListSchema,
  AdminThirdPartySaleListSchema,
  CursorListQuerySchema,
  ShopApiErrorBodySchema,
} from "@auction/shop-contracts";
import { Type } from "@sinclair/typebox";
import type { FastifyInstance } from "fastify";
import type { AdminRoutesDeps } from "../../../admin-route-deps.js";
import {
  requireShopAdminSubject,
  requireShopStaffCapability,
} from "../../../plugins/shop-admin-auth.js";
import { requireClientPartyReadAccess } from "./admin-client-access.js";

const SaleAuthorityRequestListQuerySchema = Type.Intersect([
  CursorListQuerySchema,
  Type.Object({
    status: Type.Optional(
      Type.Union([Type.Literal("pending"), Type.Literal("approved"), Type.Literal("rejected")]),
    ),
  }),
]);

export type AdminReadPhaseFlags = {
  payoutsEnabled: boolean;
  thirdPartyEnabled: boolean;
  originalsEnabled: boolean;
  merchandiseEnabled: boolean;
};

export async function registerAdminReadRoutes(
  app: FastifyInstance,
  deps: AdminRoutesDeps,
  phaseFlags: AdminReadPhaseFlags,
) {
  app.get(
    "/overview/kpis",
    {
      schema: {
        tags: ["shop-admin"],
        response: { 200: AdminOverviewKpisSchema, 403: ShopApiErrorBodySchema },
      },
    },
    async (request) => {
      requireShopStaffCapability(request, "audit.read");
      return deps.adminRead.overview.readOverviewKpis();
    },
  );

  app.get(
    "/orders",
    {
      schema: {
        tags: ["shop-admin"],
        querystring: CursorListQuerySchema,
        response: { 200: AdminOrderListSchema, 403: ShopApiErrorBodySchema },
      },
    },
    async (request) => {
      requireShopStaffCapability(request, "audit.read");
      const query = request.query as { cursor?: string; limit?: number };
      return deps.adminRead.orders.listOrders(query);
    },
  );

  app.get(
    "/orders/:orderId",
    {
      schema: {
        tags: ["shop-admin"],
        params: Type.Object({ orderId: Type.String({ format: "uuid" }) }),
        response: {
          200: AdminOrderDetailSchema,
          403: ShopApiErrorBodySchema,
          404: ShopApiErrorBodySchema,
        },
      },
    },
    async (request) => {
      requireShopStaffCapability(request, "audit.read");
      const { orderId } = request.params as { orderId: string };
      return deps.adminRead.orders.getOrderDetail(orderId);
    },
  );

  if (phaseFlags.payoutsEnabled) {
    app.get(
      "/fulfilment",
      {
        schema: {
          tags: ["shop-admin"],
          querystring: CursorListQuerySchema,
          response: { 200: AdminFulfilmentListSchema, 403: ShopApiErrorBodySchema },
        },
      },
      async (request) => {
        requireShopStaffCapability(request, "fulfilment.write");
        const query = request.query as { cursor?: string; limit?: number };
        return deps.adminRead.fulfilment.listFulfilment(query);
      },
    );

    app.get(
      "/production/tasks",
      {
        schema: {
          tags: ["shop-admin"],
          querystring: CursorListQuerySchema,
          response: { 200: AdminProductionTaskListSchema, 403: ShopApiErrorBodySchema },
        },
      },
      async (request) => {
        requireShopStaffCapability(request, "production.write");
        const query = request.query as { cursor?: string; limit?: number };
        return deps.adminRead.production.listProductionTasks(query);
      },
    );

    app.get(
      "/payouts",
      {
        schema: {
          tags: ["shop-admin"],
          querystring: CursorListQuerySchema,
          response: { 200: AdminPayoutListSchema, 403: ShopApiErrorBodySchema },
        },
      },
      async (request) => {
        requireShopStaffCapability(request, "payout.mark_paid");
        const query = request.query as { cursor?: string; limit?: number };
        return deps.adminRead.payouts.listPayouts(query);
      },
    );
  }

  if (phaseFlags.thirdPartyEnabled) {
    app.get(
      "/stock-holds",
      {
        schema: {
          tags: ["shop-admin"],
          querystring: CursorListQuerySchema,
          response: { 200: AdminStockHoldListSchema, 403: ShopApiErrorBodySchema },
        },
      },
      async (request) => {
        requireShopStaffCapability(request, "stock_hold.write");
        const subject = requireShopAdminSubject(request);
        const role = request.shopAdminAuth?.role;
        const query = request.query as { cursor?: string; limit?: number };
        return deps.adminRead.sales.listStockHolds({
          ...query,
          ...(role === "broker" ? { brokerSubjectId: subject } : {}),
        });
      },
    );

    app.get(
      "/third-party-sales",
      {
        schema: {
          tags: ["shop-admin"],
          querystring: CursorListQuerySchema,
          response: { 200: AdminThirdPartySaleListSchema, 403: ShopApiErrorBodySchema },
        },
      },
      async (request) => {
        requireShopStaffCapability(request, "third_party_sale.write");
        const query = request.query as { cursor?: string; limit?: number };
        return deps.adminRead.sales.listThirdPartySales(query);
      },
    );
  }

  if (phaseFlags.originalsEnabled) {
    app.get(
      "/original-sales",
      {
        schema: {
          tags: ["shop-admin"],
          querystring: CursorListQuerySchema,
          response: { 200: AdminOriginalSaleListSchema, 403: ShopApiErrorBodySchema },
        },
      },
      async (request) => {
        requireShopStaffCapability(request, "original_sale.write");
        const query = request.query as { cursor?: string; limit?: number };
        return deps.adminRead.sales.listOriginalSales(query);
      },
    );
  }

  app.get(
    "/sale-authority-requests",
    {
      schema: {
        tags: ["shop-admin"],
        querystring: SaleAuthorityRequestListQuerySchema,
        response: { 200: AdminSaleAuthorityRequestListSchema, 403: ShopApiErrorBodySchema },
      },
    },
    async (request) => {
      requireShopStaffCapability(request, "sale_authority.write");
      const query = request.query as { cursor?: string; limit?: number; status?: string };
      return deps.adminRead.saleAuthorityRequests.listRequests(query);
    },
  );

  app.get(
    "/clients",
    {
      schema: {
        tags: ["shop-admin"],
        querystring: CursorListQuerySchema,
        response: { 200: AdminPartyListSchema, 403: ShopApiErrorBodySchema },
      },
    },
    async (request) => {
      requireShopStaffCapability(request, "client.read_all");
      const query = request.query as { cursor?: string; limit?: number };
      return deps.adminRead.parties.listClientParties(query);
    },
  );

  app.get(
    "/clients/:partyId",
    {
      schema: {
        tags: ["shop-admin"],
        params: Type.Object({ partyId: Type.String({ format: "uuid" }) }),
        response: {
          200: AdminClientDetailSchema,
          403: ShopApiErrorBodySchema,
          404: ShopApiErrorBodySchema,
        },
      },
    },
    async (request) => {
      const { partyId } = request.params as { partyId: string };
      await requireClientPartyReadAccess(request, deps, partyId);
      return deps.adminRead.parties.getClientDetail(partyId);
    },
  );

  app.get(
    "/artists",
    {
      schema: {
        tags: ["shop-admin"],
        querystring: CursorListQuerySchema,
        response: { 200: AdminArtistListSchema, 403: ShopApiErrorBodySchema },
      },
    },
    async (request) => {
      requireShopStaffCapability(request, "catalogue.write");
      const query = request.query as { cursor?: string; limit?: number };
      return deps.adminRead.parties.listArtists(query);
    },
  );

  app.get(
    "/artists/:artistId",
    {
      schema: {
        tags: ["shop-admin"],
        params: Type.Object({ artistId: Type.String({ format: "uuid" }) }),
        response: {
          200: AdminArtistDetailSchema,
          403: ShopApiErrorBodySchema,
          404: ShopApiErrorBodySchema,
        },
      },
    },
    async (request) => {
      requireShopStaffCapability(request, "catalogue.write");
      const { artistId } = request.params as { artistId: string };
      return deps.adminRead.parties.getArtistDetail(artistId);
    },
  );

  app.get(
    "/staff",
    {
      schema: {
        tags: ["shop-admin"],
        querystring: CursorListQuerySchema,
        response: { 200: AdminStaffMemberListSchema, 403: ShopApiErrorBodySchema },
      },
    },
    async (request) => {
      requireShopStaffCapability(request, "settings.write");
      const query = request.query as { cursor?: string; limit?: number };
      return deps.adminRead.staff.listStaffMembers(query);
    },
  );

  if (phaseFlags.merchandiseEnabled) {
    app.get(
      "/merchandise/products",
      {
        schema: {
          tags: ["shop-admin"],
          querystring: CursorListQuerySchema,
          response: { 200: AdminMerchandiseProductListSchema, 403: ShopApiErrorBodySchema },
        },
      },
      async (request) => {
        requireShopStaffCapability(request, "merchandise.read");
        const query = request.query as { cursor?: string; limit?: number };
        return deps.adminRead.catalogue.listMerchandiseProducts(query);
      },
    );
  }
}
