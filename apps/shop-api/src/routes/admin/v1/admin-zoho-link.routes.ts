import {
  AdminZohoLinkBodySchema,
  AdminZohoLinkBulkBodySchema,
  AdminZohoLinkBulkResultSchema,
  AdminZohoLinkCountSchema,
  AdminZohoLinkOutcomeSchema,
  AdminZohoLinkPreviewQuerySchema,
  AdminZohoLinkPreviewSchema,
  AdminZohoLinkReportSchema,
  AdminZohoLinkSearchQuerySchema,
  AdminZohoLinkSearchResultSchema,
  AdminZohoLinkSettingsSchema,
  AdminZohoUnlinkBodySchema,
  AdminZohoUnlinkResultSchema,
  SHOP_API_ERROR_CODES,
  ShopApiErrorBodySchema,
} from "@auction/shop-contracts";
import type { Static } from "@sinclair/typebox";
import type { FastifyInstance } from "fastify";
import type { AdminRoutesDeps } from "../../../admin-route-deps.js";
import { ShopApiError } from "../../../errors/shop-api-error.js";
import {
  requireShopAdminSubject,
  requireShopStaffCapability,
} from "../../../plugins/shop-admin-auth.js";

const ERRORS = {
  400: ShopApiErrorBodySchema,
  403: ShopApiErrorBodySchema,
  404: ShopApiErrorBodySchema,
  409: ShopApiErrorBodySchema,
} as const;

const tags = ["shop-admin"];

/**
 * "Link lax.art". Seeing the report and checking a record needs `artwork_register.read`. Linking
 * changes a lax.art artwork and decides on the register, so it needs `catalogue.write` and
 * `artwork_register.review`. Removing a link is for Administrators (`artwork_register.unlink`), and
 * so is the publish switch (`settings.write`).
 */
export async function registerAdminZohoLinkRoutes(
  app: FastifyInstance,
  deps: Pick<AdminRoutesDeps, "zohoLink" | "artCache">,
) {
  const requireLinker = (request: Parameters<typeof requireShopStaffCapability>[0]) => {
    requireShopStaffCapability(request, "catalogue.write");
    requireShopStaffCapability(request, "artwork_register.review");
  };
  const refreshStorefront = () => {
    deps.artCache.invalidateCatalogue("artworks").catch(() => undefined);
  };

  app.get(
    "/artwork-register/zoho-link/count",
    { schema: { tags, response: { 200: AdminZohoLinkCountSchema, ...ERRORS } } },
    async (request) => {
      requireShopStaffCapability(request, "artwork_register.read");
      return deps.zohoLink.count();
    },
  );

  app.get(
    "/artwork-register/zoho-link/report",
    { schema: { tags, response: { 200: AdminZohoLinkReportSchema, ...ERRORS } } },
    async (request) => {
      requireShopStaffCapability(request, "artwork_register.read");
      return deps.zohoLink.report();
    },
  );

  app.get(
    "/artwork-register/zoho-link/preview",
    {
      schema: {
        tags,
        querystring: AdminZohoLinkPreviewQuerySchema,
        response: { 200: AdminZohoLinkPreviewSchema, ...ERRORS },
      },
    },
    async (request) => {
      requireShopStaffCapability(request, "artwork_register.read");
      const { artworkId, registerId } = request.query as Static<
        typeof AdminZohoLinkPreviewQuerySchema
      >;
      return deps.zohoLink.preview(artworkId, registerId);
    },
  );

  app.get(
    "/artwork-register/zoho-link/search",
    {
      schema: {
        tags,
        querystring: AdminZohoLinkSearchQuerySchema,
        response: { 200: AdminZohoLinkSearchResultSchema, ...ERRORS },
      },
    },
    async (request) => {
      requireShopStaffCapability(request, "artwork_register.read");
      const { q } = request.query as Static<typeof AdminZohoLinkSearchQuerySchema>;
      return deps.zohoLink.search(q);
    },
  );

  app.post(
    "/artwork-register/zoho-link/link",
    {
      schema: {
        tags,
        body: AdminZohoLinkBodySchema,
        response: { 200: AdminZohoLinkOutcomeSchema, ...ERRORS },
      },
    },
    async (request) => {
      requireLinker(request);
      const outcome = await deps.zohoLink.link(
        request.body as Static<typeof AdminZohoLinkBodySchema>,
        requireShopAdminSubject(request),
      );
      // The dialog shows the register's own words, so a refusal is a 409 carrying the message.
      if (outcome.status === "refused") {
        throw new ShopApiError(
          SHOP_API_ERROR_CODES.CONFLICT,
          outcome.message ?? "Not linked.",
          409,
        );
      }
      if (outcome.status === "linked") refreshStorefront();
      return outcome;
    },
  );

  app.post(
    "/artwork-register/zoho-link/link-bulk",
    {
      schema: {
        tags,
        body: AdminZohoLinkBulkBodySchema,
        response: { 200: AdminZohoLinkBulkResultSchema, ...ERRORS },
      },
    },
    async (request) => {
      requireLinker(request);
      const result = await deps.zohoLink.linkBulk(
        (request.body as Static<typeof AdminZohoLinkBulkBodySchema>).links,
        requireShopAdminSubject(request),
      );
      if (result.outcomes.some((outcome) => outcome.status === "linked")) refreshStorefront();
      return result;
    },
  );

  app.post(
    "/artwork-register/zoho-link/unlink",
    {
      schema: {
        tags,
        body: AdminZohoUnlinkBodySchema,
        response: { 200: AdminZohoUnlinkResultSchema, ...ERRORS },
      },
    },
    async (request) => {
      requireShopStaffCapability(request, "artwork_register.unlink");
      const result = await deps.zohoLink.unlink(
        request.body as Static<typeof AdminZohoUnlinkBodySchema>,
        requireShopAdminSubject(request),
      );
      if (result.unlinked) refreshStorefront();
      return result;
    },
  );

  app.get(
    "/artwork-register/zoho-link/settings",
    { schema: { tags, response: { 200: AdminZohoLinkSettingsSchema, ...ERRORS } } },
    async (request) => {
      requireShopStaffCapability(request, "artwork_register.read");
      return deps.zohoLink.settings();
    },
  );

  app.put(
    "/artwork-register/zoho-link/settings",
    {
      schema: {
        tags,
        body: AdminZohoLinkSettingsSchema,
        response: { 200: AdminZohoLinkSettingsSchema, ...ERRORS },
      },
    },
    async (request) => {
      requireShopStaffCapability(request, "settings.write");
      return deps.zohoLink.updateSettings(
        request.body as Static<typeof AdminZohoLinkSettingsSchema>,
        requireShopAdminSubject(request),
      );
    },
  );
}
