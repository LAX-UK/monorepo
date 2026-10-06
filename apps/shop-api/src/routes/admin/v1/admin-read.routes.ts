import {
  AdminArtistListSchema,
  AdminFulfilmentListSchema,
  AdminMerchandiseProductListSchema,
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
import { requireShopStaffCapability } from "../../../plugins/shop-admin-auth.js";

const SaleAuthorityRequestListQuerySchema = Type.Intersect([
  CursorListQuerySchema,
  Type.Object({
    status: Type.Optional(Type.String()),
  }),
]);

export async function registerAdminReadRoutes(app: FastifyInstance, deps: AdminRoutesDeps) {
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
      const query = request.query as { cursor?: string; limit?: number };
      return deps.adminRead.sales.listStockHolds(query);
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
