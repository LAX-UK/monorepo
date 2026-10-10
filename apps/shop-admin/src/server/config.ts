import { REGISTERED_OIDC_CLIENT_IDS } from "@auction/identity-contracts";
import { z } from "zod";

const configSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  publicOrigin: z.string().url(),
  /** Self-fetch base for server components calling the staff BFF API route. */
  bffInternalOrigin: z.string().url(),
  oidcIssuer: z.string().url(),
  oidcInternalIssuer: z.string().url(),
  oidcClientId: z.string().default(REGISTERED_OIDC_CLIENT_IDS.LAX_SHOP_ADMIN),
  oidcClientSecret: z.string().min(1),
  shopApiBaseUrl: z.string().url(),
  redisUrl: z.string().min(1),
  sessionEncryptionKey: z.string().min(32),
  sessionTtlSeconds: z.coerce.number().int().min(300).default(604_800),
  release: z.string().optional(),
  bidPublicUrl: z.string().url().optional(),
});

export type ShopAdminConfig = z.infer<typeof configSchema>;

export function loadShopAdminConfig(source: NodeJS.ProcessEnv = process.env): ShopAdminConfig {
  const publicOrigin = (
    source.SHOP_ADMIN_PUBLIC_ORIGIN ??
    (source.NODE_ENV === "production" ? "https://admin.shop.lax.art" : "http://localhost:3030")
  ).replace(/\/+$/, "");
  const oidcIssuer = (source.OIDC_ISSUER_URL ?? source.NEXT_PUBLIC_AUTH_URL)?.replace(/\/+$/, "");
  if (!oidcIssuer) {
    throw new Error("OIDC_ISSUER_URL is required for shop-admin");
  }
  const parsed = configSchema.safeParse({
    NODE_ENV: source.NODE_ENV ?? "development",
    publicOrigin,
    bffInternalOrigin: (
      source.SHOP_ADMIN_INTERNAL_URL ??
      publicOrigin ??
      "http://127.0.0.1:3030"
    ).replace(/\/+$/, ""),
    oidcIssuer,
    oidcInternalIssuer: (source.OIDC_INTERNAL_BASE_URL ?? oidcIssuer).replace(/\/+$/, ""),
    oidcClientId: source.OIDC_CLIENT_ID ?? REGISTERED_OIDC_CLIENT_IDS.LAX_SHOP_ADMIN,
    oidcClientSecret: source.OIDC_CLIENT_SECRET_LAX_SHOP_ADMIN,
    shopApiBaseUrl: (source.SHOP_API_BASE_URL ?? "http://127.0.0.1:3011").replace(/\/+$/, ""),
    redisUrl: source.REDIS_URL ?? "redis://127.0.0.1:6379",
    sessionEncryptionKey: source.SHOP_ADMIN_SESSION_ENCRYPTION_KEY,
    sessionTtlSeconds: source.SHOP_ADMIN_SESSION_TTL_SECONDS ?? "604800",
    release: source.SENTRY_RELEASE ?? source.GITHUB_SHA,
    bidPublicUrl: source.LAX_BID_PUBLIC_URL?.trim().replace(/\/+$/, "") || undefined,
  });
  if (!parsed.success) {
    console.error(parsed.error.flatten());
    throw new Error("Invalid shop-admin environment");
  }
  return parsed.data;
}
