import {
  AdminArtistDetailSchema,
  type AdminArtistListQuery,
  AdminArtistListQuerySchema,
  AdminArtistListSchema,
  AdminArtworkLookupSchema,
  AdminAuditFacetsSchema,
  type AdminAuditListQuery,
  AdminAuditListQuerySchema,
  AdminAuditListSchema,
  AdminClientDetailSchema,
  type AdminClientListQuery,
  AdminClientListQuerySchema,
  type AdminDisputeListQuery,
  AdminDisputeListQuerySchema,
  AdminDisputeListSchema,
  AdminEditionLookupSchema,
  AdminEffectiveSettingsSchema,
  type AdminFulfilmentListQuery,
  AdminFulfilmentListQuerySchema,
  AdminFulfilmentListSchema,
  type AdminLookupQuery,
  AdminLookupQuerySchema,
  AdminOrderDetailSchema,
  type AdminOrderListQuery,
  AdminOrderListQuerySchema,
  AdminOrderListSchema,
  AdminOrderSummarySchema,
  type AdminOriginalSaleListQuery,
  AdminOriginalSaleListQuerySchema,
  AdminOriginalSaleListSchema,
  AdminOverviewKpisSchema,
  AdminPartyListSchema,
  AdminPartyLookupSchema,
  type AdminPayoutListQuery,
  AdminPayoutListQuerySchema,
  AdminPayoutListSchema,
  type AdminSaleAuthorityRequestListQuery,
  AdminSaleAuthorityRequestListQuerySchema,
  AdminSaleAuthorityRequestListSchema,
  type AdminStaffListQuery,
  AdminStaffListQuerySchema,
  AdminStaffMemberListSchema,
  type AdminStockHoldListQuery,
  AdminStockHoldListQuerySchema,
  AdminStockHoldListSchema,
  type AdminThirdPartySaleListQuery,
  AdminThirdPartySaleListQuerySchema,
  AdminThirdPartySaleListSchema,
  SHOP_API_ERROR_CODES,
  ShopApiErrorBodySchema,
} from "@auction/shop-contracts";
import {
  OVERVIEW_LOW_STOCK_CAPABILITY,
  clientListScope,
  overviewKpiKeysFor,
} from "@auction/shop-domain";
import { Type } from "@sinclair/typebox";
import type { FastifyInstance } from "fastify";
import type { AdminRoutesDeps } from "../../../admin-route-deps.js";
import { parseOrderListQuery } from "../../../application/admin-order-list-query.js";
import { buildOrderSummary, orderSummarySince } from "../../../application/admin-order-summary.js";
import { withRetainedInvoiceAccess } from "../../../application/guest-erasure/retained-invoice-access.js";
import { ShopApiError } from "../../../errors/shop-api-error.js";
import {
  requireAnyShopStaffCapability,
  requireShopAdminSubject,
  requireShopStaffAuth,
  requireShopStaffCapability,
  staffCan,
} from "../../../plugins/shop-admin-auth.js";
import { requireClientPartyReadAccess } from "./admin-client-access.js";

const DEFAULT_LOOKUP_LIMIT = 15;

/** Who may search for people: anyone who picks a client, buyer or seller in a form. */
const PARTY_LOOKUP_CAPABILITIES = [
  "sale_authority.write",
  "original_sale.write",
  "third_party_sale.write",
  "stock_hold.write",
] as const;

/** Who may search for artworks: sale authority and original sales, and the catalogue itself. */
const ARTWORK_LOOKUP_CAPABILITIES = [
  "sale_authority.write",
  "original_sale.write",
  "catalogue.write",
] as const;

/** Who may search for editions: holds and third-party sales. */
const EDITION_LOOKUP_CAPABILITIES = ["stock_hold.write", "third_party_sale.write"] as const;

export type AdminReadPhaseFlags = {
  payoutsEnabled: boolean;
  thirdPartyEnabled: boolean;
  originalsEnabled: boolean;
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
      // Open to any signed-in staff member; each figure is gated by the capability for its list.
      const auth = requireShopStaffAuth(request);
      const overview = deps.adminRead.overview;
      const [kpis, lowStockRuns] = await Promise.all([
        overview.readOverviewKpis(overviewKpiKeysFor(auth.capabilities)),
        staffCan(auth, OVERVIEW_LOW_STOCK_CAPABILITY) ? overview.listLowStockRuns() : null,
      ]);
      return lowStockRuns ? { ...kpis, lowStockRuns } : kpis;
    },
  );

  app.get(
    "/orders",
    {
      schema: {
        tags: ["shop-admin"],
        querystring: AdminOrderListQuerySchema,
        response: {
          200: AdminOrderListSchema,
          400: ShopApiErrorBodySchema,
          403: ShopApiErrorBodySchema,
        },
      },
    },
    async (request) => {
      requireShopStaffCapability(request, "order.read");
      return deps.adminRead.orders.listOrders(
        parseOrderListQuery(request.query as AdminOrderListQuery),
      );
    },
  );

  app.get(
    "/orders/summary",
    {
      schema: {
        tags: ["shop-admin"],
        response: { 200: AdminOrderSummarySchema, 403: ShopApiErrorBodySchema },
      },
    },
    async (request) => {
      requireShopStaffCapability(request, "order.read");
      const now = new Date();
      const totals = await deps.adminRead.orders.readOrderDailyTotals(orderSummarySince(now));
      return buildOrderSummary(totals, now);
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
      requireShopStaffCapability(request, "order.read");
      const { orderId } = request.params as { orderId: string };
      const detail = await deps.adminRead.orders.getOrderDetail(orderId);
      return withRetainedInvoiceAccess(
        detail,
        staffCan(requireShopStaffAuth(request), "retained_invoice_data.read"),
      );
    },
  );

  if (phaseFlags.payoutsEnabled) {
    app.get(
      "/fulfilment",
      {
        schema: {
          tags: ["shop-admin"],
          querystring: AdminFulfilmentListQuerySchema,
          response: { 200: AdminFulfilmentListSchema, 403: ShopApiErrorBodySchema },
        },
      },
      async (request) => {
        requireShopStaffCapability(request, "fulfilment.write");
        return deps.adminRead.fulfilment.listFulfilment(request.query as AdminFulfilmentListQuery);
      },
    );

    app.get(
      "/payouts",
      {
        schema: {
          tags: ["shop-admin"],
          querystring: AdminPayoutListQuerySchema,
          response: { 200: AdminPayoutListSchema, 403: ShopApiErrorBodySchema },
        },
      },
      async (request) => {
        requireShopStaffCapability(request, "payout.mark_paid");
        return deps.adminRead.payouts.listPayouts(request.query as AdminPayoutListQuery);
      },
    );
  }

  if (phaseFlags.thirdPartyEnabled) {
    app.get(
      "/stock-holds",
      {
        schema: {
          tags: ["shop-admin"],
          querystring: AdminStockHoldListQuerySchema,
          response: { 200: AdminStockHoldListSchema, 403: ShopApiErrorBodySchema },
        },
      },
      async (request) => {
        const auth = requireShopStaffCapability(request, "stock_hold.write");
        const query = request.query as AdminStockHoldListQuery;
        // Staff who may only hold for their own clients see only their own holds.
        return deps.adminRead.sales.listStockHolds({
          ...query,
          ...(staffCan(auth, "stock_hold.override") ? {} : { brokerSubjectId: auth.subject }),
        });
      },
    );

    app.get(
      "/third-party-sales",
      {
        schema: {
          tags: ["shop-admin"],
          querystring: AdminThirdPartySaleListQuerySchema,
          response: { 200: AdminThirdPartySaleListSchema, 403: ShopApiErrorBodySchema },
        },
      },
      async (request) => {
        // Operations record the sales; finance approves each sale's fees from the same list.
        requireAnyShopStaffCapability(request, ["third_party_sale.write", "fee.approve"]);
        return deps.adminRead.sales.listThirdPartySales(
          request.query as AdminThirdPartySaleListQuery,
        );
      },
    );
  }

  if (phaseFlags.originalsEnabled) {
    app.get(
      "/original-sales",
      {
        schema: {
          tags: ["shop-admin"],
          querystring: AdminOriginalSaleListQuerySchema,
          response: { 200: AdminOriginalSaleListSchema, 403: ShopApiErrorBodySchema },
        },
      },
      async (request) => {
        requireShopStaffCapability(request, "original_sale.write");
        return deps.adminRead.sales.listOriginalSales(request.query as AdminOriginalSaleListQuery);
      },
    );
  }

  app.get(
    "/sale-authority-requests",
    {
      schema: {
        tags: ["shop-admin"],
        querystring: AdminSaleAuthorityRequestListQuerySchema,
        response: { 200: AdminSaleAuthorityRequestListSchema, 403: ShopApiErrorBodySchema },
      },
    },
    async (request) => {
      requireShopStaffCapability(request, "sale_authority.write");
      return deps.adminRead.saleAuthorityRequests.listRequests(
        request.query as AdminSaleAuthorityRequestListQuery,
      );
    },
  );

  app.get(
    "/clients",
    {
      schema: {
        tags: ["shop-admin"],
        querystring: AdminClientListQuerySchema,
        response: { 200: AdminPartyListSchema, 403: ShopApiErrorBodySchema },
      },
    },
    async (request) => {
      const auth = requireShopStaffAuth(request);
      const scope = clientListScope(auth.capabilities);
      if (scope === "none") {
        throw new ShopApiError(SHOP_API_ERROR_CODES.FORBIDDEN, "Insufficient capability", 403);
      }
      const query = request.query as AdminClientListQuery;
      return deps.adminRead.parties.listClientParties({
        ...query,
        ...(scope === "assigned" ? { brokerSubjectId: requireShopAdminSubject(request) } : {}),
      });
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
        querystring: AdminArtistListQuerySchema,
        response: { 200: AdminArtistListSchema, 403: ShopApiErrorBodySchema },
      },
    },
    async (request) => {
      requireShopStaffCapability(request, "catalogue.read");
      return deps.adminRead.parties.listArtists(request.query as AdminArtistListQuery);
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
      requireShopStaffCapability(request, "catalogue.read");
      const { artistId } = request.params as { artistId: string };
      return deps.adminRead.parties.getArtistDetail(artistId);
    },
  );

  const lookupLimit = (query: AdminLookupQuery) => query.limit ?? DEFAULT_LOOKUP_LIMIT;

  app.get(
    "/lookups/parties",
    {
      schema: {
        tags: ["shop-admin"],
        querystring: AdminLookupQuerySchema,
        response: { 200: AdminPartyLookupSchema, 403: ShopApiErrorBodySchema },
      },
    },
    async (request) => {
      const auth = requireAnyShopStaffCapability(request, [...PARTY_LOOKUP_CAPABILITIES]);
      const query = request.query as AdminLookupQuery;
      // A broker finds only the clients assigned to them, as on the Clients page.
      const scope = clientListScope(auth.capabilities);
      return {
        items: await deps.adminRead.lookups.searchParties({
          q: query.q,
          limit: lookupLimit(query),
          ...(scope === "assigned" ? { brokerSubjectId: auth.subject } : {}),
        }),
      };
    },
  );

  app.get(
    "/lookups/artworks",
    {
      schema: {
        tags: ["shop-admin"],
        querystring: AdminLookupQuerySchema,
        response: { 200: AdminArtworkLookupSchema, 403: ShopApiErrorBodySchema },
      },
    },
    async (request) => {
      requireAnyShopStaffCapability(request, [...ARTWORK_LOOKUP_CAPABILITIES]);
      const query = request.query as AdminLookupQuery;
      return {
        items: await deps.adminRead.lookups.searchArtworks({
          q: query.q,
          limit: lookupLimit(query),
        }),
      };
    },
  );

  app.get(
    "/lookups/editions",
    {
      schema: {
        tags: ["shop-admin"],
        querystring: AdminLookupQuerySchema,
        response: { 200: AdminEditionLookupSchema, 403: ShopApiErrorBodySchema },
      },
    },
    async (request) => {
      requireAnyShopStaffCapability(request, [...EDITION_LOOKUP_CAPABILITIES]);
      const query = request.query as AdminLookupQuery;
      return {
        items: await deps.adminRead.lookups.searchEditions({
          q: query.q,
          limit: lookupLimit(query),
        }),
      };
    },
  );

  app.get(
    "/staff",
    {
      schema: {
        tags: ["shop-admin"],
        querystring: AdminStaffListQuerySchema,
        response: { 200: AdminStaffMemberListSchema, 403: ShopApiErrorBodySchema },
      },
    },
    async (request) => {
      requireShopStaffCapability(request, "settings.write");
      return deps.adminRead.staff.listStaffMembers(request.query as AdminStaffListQuery);
    },
  );

  app.get(
    "/audit",
    {
      schema: {
        tags: ["shop-admin"],
        querystring: AdminAuditListQuerySchema,
        response: { 200: AdminAuditListSchema, 403: ShopApiErrorBodySchema },
      },
    },
    async (request) => {
      requireShopStaffCapability(request, "audit.read");
      return deps.adminRead.compliance.listAuditEntries(request.query as AdminAuditListQuery);
    },
  );

  app.get(
    "/audit/facets",
    {
      schema: {
        tags: ["shop-admin"],
        response: { 200: AdminAuditFacetsSchema, 403: ShopApiErrorBodySchema },
      },
    },
    async (request) => {
      requireShopStaffCapability(request, "audit.read");
      return deps.adminRead.compliance.readAuditFacets();
    },
  );

  app.get(
    "/disputes",
    {
      schema: {
        tags: ["shop-admin"],
        querystring: AdminDisputeListQuerySchema,
        response: { 200: AdminDisputeListSchema, 403: ShopApiErrorBodySchema },
      },
    },
    async (request) => {
      requireShopStaffCapability(request, "audit.read");
      return deps.adminRead.compliance.listDisputes(request.query as AdminDisputeListQuery);
    },
  );

  app.get(
    "/settings/effective",
    {
      schema: {
        tags: ["shop-admin"],
        response: { 200: AdminEffectiveSettingsSchema, 403: ShopApiErrorBodySchema },
      },
    },
    async (request) => {
      requireShopStaffCapability(request, "settings.write");
      return deps.adminRead.compliance.readEffectiveSettings();
    },
  );
}
