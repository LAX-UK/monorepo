import {
  ArtworkInterestIntentSchema,
  ArtworkInterestStatusSchema,
  RegisterArtworkInterestRequestSchema,
  RegisterArtworkInterestResponseSchema,
  SHOP_API_ERROR_CODES,
  ShopApiErrorBodySchema,
} from "@auction/shop-contracts";
import { Type } from "@sinclair/typebox";
import type { Static } from "@sinclair/typebox";
import type { FastifyInstance } from "fastify";
import { normalizeArtworkInterestIntent } from "../../application/artwork-interest-intent.js";
import type { EnquirySender } from "../../application/enquiry-sender.js";
import { ShopApiError, notFound } from "../../errors/shop-api-error.js";
import type { InterestRoutesDeps } from "../../interest-route-deps.js";
import { requireShopScope, requireShopSubject } from "../../plugins/shop-auth.js";
import { registerEditionAlertFromRequest } from "./edition-alerts.routes.js";
import { type EnquiryContactBody, admitEnquiry } from "./enquiry-admission.js";

type ArtworkInterestIntent = Static<typeof ArtworkInterestIntentSchema>;

const InterestQuerySchema = Type.Object({
  intent: Type.Optional(ArtworkInterestIntentSchema),
});

export async function registerArtworkInterestRoutes(
  app: FastifyInstance,
  deps: InterestRoutesDeps,
) {
  app.get(
    "/v1/artworks/:slug/interest",
    {
      schema: {
        tags: ["catalogue"],
        params: {
          type: "object",
          properties: { slug: { type: "string", minLength: 1 } },
          required: ["slug"],
        },
        querystring: InterestQuerySchema,
        response: {
          200: ArtworkInterestStatusSchema,
          401: ShopApiErrorBodySchema,
          403: ShopApiErrorBodySchema,
          404: ShopApiErrorBodySchema,
        },
      },
    },
    async (request) => {
      requireShopScope(request, "shop.read");
      const subject = requireShopSubject(request);
      const { slug } = request.params as { slug: string };
      const query = request.query as { intent?: ArtworkInterestIntent };
      const intent = normalizeArtworkInterestIntent(query.intent);
      const result = await deps.getArtworkInterest({
        artworkSlug: slug,
        identitySubjectId: subject,
        intent,
      });
      if (result === "artwork_not_found") {
        throw notFound("Artwork");
      }
      return result;
    },
  );

  app.post(
    "/v1/artworks/:slug/interest",
    {
      // Global limit is 1 KiB; a 2000-char enquiry message can be up to ~12 KiB as escaped JSON.
      bodyLimit: 16_384,
      schema: {
        tags: ["catalogue"],
        params: {
          type: "object",
          properties: { slug: { type: "string", minLength: 1 } },
          required: ["slug"],
        },
        body: RegisterArtworkInterestRequestSchema,
        response: {
          200: RegisterArtworkInterestResponseSchema,
          400: ShopApiErrorBodySchema,
          401: ShopApiErrorBodySchema,
          403: ShopApiErrorBodySchema,
          404: ShopApiErrorBodySchema,
          409: ShopApiErrorBodySchema,
          429: ShopApiErrorBodySchema,
        },
      },
    },
    async (request, reply) => {
      const { slug } = request.params as { slug: string };
      const body = (request.body ?? {}) as EnquiryContactBody & {
        intent?: ArtworkInterestIntent;
        message?: string;
        contactPhone?: string;
      };
      const intent = normalizeArtworkInterestIntent(body.intent);
      if (intent === "notify_me") {
        const status = await registerEditionAlertFromRequest(request, reply, deps, {
          artworkSlug: slug,
          email: body.email,
          website: body.website,
        });
        return { status };
      }
      const admission = await admitEnquiry(request, reply, deps.enquiryRateLimiter, body);
      if (admission.kind === "honeypot") return { status: "registered" as const };
      const sender: EnquirySender = admission.sender;
      const result = await deps.registerArtworkInterest({
        artworkSlug: slug,
        sender,
        intent,
        ...(body.message ? { message: body.message } : {}),
        ...(body.contactPhone ? { contactPhone: body.contactPhone } : {}),
      });
      if (result.status === "artwork_not_found") {
        throw notFound("Artwork");
      }
      if (result.status === "not_subscribable") {
        throw new ShopApiError(
          SHOP_API_ERROR_CODES.CONFLICT,
          "This artwork is not accepting enquiries",
          409,
        );
      }
      return {
        status: result.status,
        ...(result.reference ? { reference: result.reference } : {}),
      };
    },
  );
}
