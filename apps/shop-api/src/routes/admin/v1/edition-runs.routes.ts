import {
  type AdminCompanionListingBody,
  AdminCompanionListingBodySchema,
  type AdminEditionFactsBulkBody,
  AdminEditionFactsBulkBodySchema,
  AdminEditionFactsBulkResponseSchema,
  type AdminEditionFactsCorrectBody,
  AdminEditionFactsCorrectBodySchema,
  type AdminEditionFactsSaveBody,
  AdminEditionFactsSaveBodySchema,
  AdminEditionFactsSaveResponseSchema,
  AdminLinkedListingResponseSchema,
  type AdminProofListingBody,
  AdminProofListingBodySchema,
  type AdminRunUpdateBody,
  AdminRunUpdateBodySchema,
  type AdminStockBatchBody,
  AdminStockBatchBodySchema,
  AdminStockBatchResponseSchema,
  CatalogueConflictBodySchema,
  ShopApiErrorBodySchema,
} from "@auction/shop-contracts";
import { roleHasCapability } from "@auction/shop-domain";
import { type Static, Type } from "@sinclair/typebox";
import type { FastifyInstance, FastifyRequest } from "fastify";
import type { AdminRoutesDeps } from "../../../admin-route-deps.js";
import {
  editionFactsInput,
  proofsKeptInput,
  stockBatchCommand,
} from "../../../application/edition-runs/edition-run-input.js";
import { requireIdempotencyKey } from "../../../plugins/require-idempotency-key.js";
import {
  requireShopAdminSubject,
  requireShopStaffCapability,
} from "../../../plugins/shop-admin-auth.js";

const ArtworkParams = Type.Object({ id: Type.String({ format: "uuid" }) });

const WRITE_ERRORS = {
  400: ShopApiErrorBodySchema,
  403: ShopApiErrorBodySchema,
  404: ShopApiErrorBodySchema,
  409: CatalogueConflictBodySchema,
} as const;

/** A companion carries a whole run and its facts; still far under the artwork body limit. */
const RUN_BODY_LIMIT = 16_384;

/** Every edition run write needs `catalogue.write`; the actor and key travel with it. */
function catalogueWriter(request: FastifyRequest) {
  const auth = requireShopStaffCapability(request, "catalogue.write");
  return {
    auth,
    actorSubjectId: requireShopAdminSubject(request),
    idempotencyKey: requireIdempotencyKey(request),
  };
}

function artworkId(request: FastifyRequest): string {
  return (request.params as Static<typeof ArtworkParams>).id;
}

/**
 * Runs of prints in LAX Admin: change a draft's run, record and confirm its edition facts,
 * correct them after a sale (shop admins), add open edition stock, and create proof and
 * companion listings. Thin: each route checks access and hands one command to its use case.
 */
export async function registerAdminEditionRunRoutes(
  app: FastifyInstance,
  deps: Pick<AdminRoutesDeps, "editionRuns">,
) {
  const { runs, facts, stock, listings } = deps.editionRuns;

  app.put(
    "/artworks/:id/run",
    {
      bodyLimit: RUN_BODY_LIMIT,
      schema: {
        tags: ["shop-admin"],
        params: ArtworkParams,
        body: AdminRunUpdateBodySchema,
        response: { 200: Type.Object({ version: Type.String() }), ...WRITE_ERRORS },
      },
    },
    async (request) => {
      const { auth: _auth, ...actor } = catalogueWriter(request);
      const body = request.body as AdminRunUpdateBody;
      return runs.replace({
        ...actor,
        artworkId: artworkId(request),
        run: body.spec,
        proofsKept: proofsKeptInput(body.proofsKept),
        expectedVersion: body.expectedVersion,
      });
    },
  );

  app.put(
    "/artworks/:id/edition-facts",
    {
      bodyLimit: RUN_BODY_LIMIT,
      schema: {
        tags: ["shop-admin"],
        params: ArtworkParams,
        body: AdminEditionFactsSaveBodySchema,
        response: { 200: AdminEditionFactsSaveResponseSchema, ...WRITE_ERRORS },
      },
    },
    async (request) => {
      const { auth: _auth, ...actor } = catalogueWriter(request);
      const body = request.body as AdminEditionFactsSaveBody;
      return facts.save({
        ...actor,
        artworkId: artworkId(request),
        facts: editionFactsInput(body.facts),
        confirmed: body.confirmed,
        expectedFactsVersion: body.expectedFactsVersion,
      });
    },
  );

  app.post(
    "/artworks/:id/edition-facts/correct",
    {
      bodyLimit: RUN_BODY_LIMIT,
      schema: {
        tags: ["shop-admin"],
        params: ArtworkParams,
        body: AdminEditionFactsCorrectBodySchema,
        response: {
          200: Type.Intersect([
            AdminEditionFactsSaveResponseSchema,
            Type.Object({ affectedOrders: Type.Integer({ minimum: 0 }) }),
          ]),
          ...WRITE_ERRORS,
        },
      },
    },
    async (request) => {
      requireShopStaffCapability(request, "edition_facts.correct");
      const body = request.body as AdminEditionFactsCorrectBody;
      return facts.correct({
        actorSubjectId: requireShopAdminSubject(request),
        idempotencyKey: requireIdempotencyKey(request),
        artworkId: artworkId(request),
        facts: editionFactsInput(body.facts),
        reason: body.reason,
        expectedFactsVersion: body.expectedFactsVersion,
      });
    },
  );

  app.post(
    "/artworks/edition-facts",
    {
      bodyLimit: RUN_BODY_LIMIT,
      schema: {
        tags: ["shop-admin"],
        body: AdminEditionFactsBulkBodySchema,
        response: { 200: AdminEditionFactsBulkResponseSchema, ...WRITE_ERRORS },
      },
    },
    async (request) => {
      const { auth: _auth, ...actor } = catalogueWriter(request);
      const body = request.body as AdminEditionFactsBulkBody;
      return facts.setForRuns({
        ...actor,
        artworkIds: body.artworkIds,
        facts: editionFactsInput(body.facts),
        confirmed: body.confirmed,
      });
    },
  );

  app.post(
    "/artworks/:id/stock-batches",
    {
      schema: {
        tags: ["shop-admin"],
        params: ArtworkParams,
        body: AdminStockBatchBodySchema,
        response: { 200: AdminStockBatchResponseSchema, ...WRITE_ERRORS },
      },
    },
    async (request) => {
      const { auth: _auth, ...actor } = catalogueWriter(request);
      return stock.add({
        ...actor,
        artworkId: artworkId(request),
        batch: stockBatchCommand(request.body as AdminStockBatchBody),
      });
    },
  );

  app.post(
    "/artworks/:id/proof-listings",
    {
      schema: {
        tags: ["shop-admin"],
        params: ArtworkParams,
        body: AdminProofListingBodySchema,
        response: { 200: AdminLinkedListingResponseSchema, ...WRITE_ERRORS },
      },
    },
    async (request) => {
      const { auth, ...actor } = catalogueWriter(request);
      const body = request.body as AdminProofListingBody;
      return listings.createProofListing({
        ...actor,
        mainArtworkId: artworkId(request),
        proofType: body.proofType,
        count: body.count,
        owner: body.owner,
        printPricePence: body.printPricePence ?? null,
        horsCommerceApproved: body.horsCommerceApproved ?? false,
        canSetPrice: roleHasCapability(auth.role, "artwork_price.write"),
        canApproveHorsCommerce: roleHasCapability(auth.role, "hors_commerce.approve"),
      });
    },
  );

  app.post(
    "/artworks/:id/companion-listings",
    {
      bodyLimit: RUN_BODY_LIMIT,
      schema: {
        tags: ["shop-admin"],
        params: ArtworkParams,
        body: AdminCompanionListingBodySchema,
        response: { 200: AdminLinkedListingResponseSchema, ...WRITE_ERRORS },
      },
    },
    async (request) => {
      const { auth, ...actor } = catalogueWriter(request);
      const body = request.body as AdminCompanionListingBody;
      return listings.createCompanionListing({
        ...actor,
        mainArtworkId: artworkId(request),
        slug: body.slug,
        title: body.title.trim(),
        run: body.run,
        printPricePence: body.printPricePence ?? null,
        canSetPrice: roleHasCapability(auth.role, "artwork_price.write"),
      });
    },
  );
}
