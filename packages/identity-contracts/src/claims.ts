import { z } from "zod";

/** Default `aud` claim for first-party JWTs issued by the Identity JWT plugin. */
export const DEFAULT_JWT_AUDIENCE = "lax-bid-api";

/** First-party access-token lifetime shared by Identity issuers and exchanges. */
export const ACCESS_TOKEN_TTL_SECONDS = 15 * 60;

/**
 * Cross-product id_token / external consumer contract.
 * Product authorization claims (role, staff_role, KYC, etc.) are intentionally excluded.
 */
export const CROSS_PLATFORM_ID_TOKEN_CLAIMS = [
  "sub",
  "iss",
  "aud",
  "iat",
  "exp",
  "sid",
  "auth_time",
  "acr",
  "amr",
  "email",
  "email_verified",
  "name",
] as const;

/** Verification-essential access-token claims for remote consumers. */
export const MINIMAL_ACCESS_TOKEN_CLAIMS = ["sub", "iss", "aud", "iat", "exp", "sid"] as const;

export type CrossPlatformIdTokenClaim = (typeof CROSS_PLATFORM_ID_TOKEN_CLAIMS)[number];
export type MinimalAccessTokenClaim = (typeof MINIMAL_ACCESS_TOKEN_CLAIMS)[number];

const jwtAudienceSchema = z.union([z.string(), z.array(z.string())]);
/** NumericDate seconds; the upper bound also catches accidental JavaScript milliseconds. */
const numericDateSchema = z.number().int().nonnegative().max(32_503_680_000);
export const OIDC_ACR_BRONZE = "urn:mace:incommon:iap:bronze";
export const OIDC_ACR_SILVER = "urn:mace:incommon:iap:silver";

export const crossPlatformIdTokenPayloadSchemaV1 = z.object({
  sub: z.string(),
  iss: z.string(),
  aud: jwtAudienceSchema,
  iat: numericDateSchema,
  exp: numericDateSchema,
  sid: z.string().min(1),
  auth_time: numericDateSchema,
  acr: z.enum([OIDC_ACR_BRONZE, OIDC_ACR_SILVER]),
  amr: z.array(z.string().min(1)).min(1).optional(),
  email: z.string().email().optional(),
  email_verified: z.boolean().optional(),
  name: z.string().optional(),
});

export const minimalAccessTokenPayloadSchemaV1 = z.object({
  sub: z.string(),
  iss: z.string(),
  aud: jwtAudienceSchema,
  iat: z.number(),
  exp: z.number(),
  sid: z.string().optional(),
});

export type CrossPlatformIdTokenPayloadV1 = z.infer<typeof crossPlatformIdTokenPayloadSchemaV1>;
export type MinimalAccessTokenPayloadV1 = z.infer<typeof minimalAccessTokenPayloadSchemaV1>;
