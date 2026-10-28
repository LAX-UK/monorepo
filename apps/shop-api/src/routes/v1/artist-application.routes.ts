import {
  type ArtistApplicationConfirmBody,
  ArtistApplicationConfirmBodySchema,
  ArtistApplicationIncompleteBodySchema,
  type ArtistApplicationPresignBody,
  ArtistApplicationPresignBodySchema,
  ArtistApplicationPresignResponseSchema,
  MyArtistApplicationSchema,
  MyArtistApplicationStateSchema,
  type SaveArtistApplicationBody,
  SaveArtistApplicationBodySchema,
  ShopApiErrorBodySchema,
  type SubmitArtistApplicationBody,
  SubmitArtistApplicationBodySchema,
} from "@auction/shop-contracts";
import { Type } from "@sinclair/typebox";
import type { FastifyInstance } from "fastify";
import type { ArtistApplicantService } from "../../application/artist-applications/artist-applicant.service.js";
import {
  SELLER_READ_SCOPES,
  requireAnyShopScope,
  requireShopScope,
  requireShopSubject,
} from "../../plugins/shop-auth.js";

/** A full draft can hold several thousand characters, far over the app-wide 1 KiB body cap. */
const DRAFT_BODY_LIMIT_BYTES = 65_536;

const Params = Type.Object({ id: Type.String({ format: "uuid" }) });
type IdParams = { id: string };

const ERRORS = {
  400: ShopApiErrorBodySchema,
  401: ShopApiErrorBodySchema,
  403: ShopApiErrorBodySchema,
  404: ShopApiErrorBodySchema,
  409: ShopApiErrorBodySchema,
  429: ShopApiErrorBodySchema,
} as const;

/**
 * The applicant's own application, for the signed-in account only: lax.art writes it, and LAX
 * Account reads it in the Selling area (with its selling scope).
 */
export async function registerArtistApplicationRoutes(
  app: FastifyInstance,
  applicant: ArtistApplicantService,
) {
  app.get(
    "/v1/me/artist-application",
    {
      schema: {
        tags: ["artist-applications"],
        response: { 200: MyArtistApplicationStateSchema, 401: ShopApiErrorBodySchema },
      },
    },
    async (request) => {
      requireAnyShopScope(request, SELLER_READ_SCOPES);
      return applicant.getState(requireShopSubject(request));
    },
  );

  app.post(
    "/v1/me/artist-application",
    {
      schema: {
        tags: ["artist-applications"],
        response: { 200: MyArtistApplicationSchema, ...ERRORS },
      },
    },
    async (request) => {
      requireShopScope(request, "shop.write");
      return applicant.start(requireShopSubject(request));
    },
  );

  app.put(
    "/v1/me/artist-application/:id",
    {
      bodyLimit: DRAFT_BODY_LIMIT_BYTES,
      schema: {
        tags: ["artist-applications"],
        params: Params,
        body: SaveArtistApplicationBodySchema,
        response: { 200: MyArtistApplicationSchema, ...ERRORS },
      },
    },
    async (request) => {
      requireShopScope(request, "shop.write");
      const { id } = request.params as IdParams;
      return applicant.save(
        requireShopSubject(request),
        id,
        request.body as SaveArtistApplicationBody,
      );
    },
  );

  app.post(
    "/v1/me/artist-application/:id/submit",
    {
      schema: {
        tags: ["artist-applications"],
        params: Params,
        body: SubmitArtistApplicationBodySchema,
        response: {
          200: MyArtistApplicationSchema,
          ...ERRORS,
          400: ArtistApplicationIncompleteBodySchema,
        },
      },
    },
    async (request) => {
      requireShopScope(request, "shop.write");
      const { id } = request.params as IdParams;
      const body = request.body as SubmitArtistApplicationBody;
      return applicant.submit(requireShopSubject(request), id, body.expectedVersion);
    },
  );

  app.post(
    "/v1/me/artist-application/:id/images/presign",
    {
      schema: {
        tags: ["artist-applications"],
        params: Params,
        body: ArtistApplicationPresignBodySchema,
        response: {
          200: ArtistApplicationPresignResponseSchema,
          ...ERRORS,
          503: ShopApiErrorBodySchema,
        },
      },
    },
    async (request) => {
      requireShopScope(request, "shop.write");
      const { id } = request.params as IdParams;
      const body = request.body as ArtistApplicationPresignBody;
      return applicant.presignImage(requireShopSubject(request), id, body);
    },
  );

  app.post(
    "/v1/me/artist-application/:id/images/confirm",
    {
      schema: {
        tags: ["artist-applications"],
        params: Params,
        body: ArtistApplicationConfirmBodySchema,
        response: { 200: MyArtistApplicationSchema, ...ERRORS, 503: ShopApiErrorBodySchema },
      },
    },
    async (request) => {
      requireShopScope(request, "shop.write");
      const { id } = request.params as IdParams;
      const body = request.body as ArtistApplicationConfirmBody;
      return applicant.confirmImage(requireShopSubject(request), id, body.key);
    },
  );
}
