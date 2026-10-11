import { REGISTERED_OIDC_CLIENT_IDS } from "@auction/identity-contracts";
import { z } from "zod";

const configSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  publicOrigin: z.string().url(),
  oidcIssuer: z.string().url(),
  oidcInternalIssuer: z.string().url(),
  oidcClientId: z.string().default(REGISTERED_OIDC_CLIENT_IDS.LAX_ACCOUNT_WEB),
  oidcClientSecret: z.string().min(1),
  redisUrl: z.string().min(1),
  sessionEncryptionKey: z.string().min(32),
  sessionTtlSeconds: z.coerce.number().int().min(300).default(604_800),
  bidPublicUrl: z.string().url().optional(),
  shopAdminUrl: z.string().url().optional(),
});

export type LaxAccountConfig = z.infer<typeof configSchema>;

export function loadLaxAccountConfig(source: NodeJS.ProcessEnv = process.env): LaxAccountConfig {
  const publicOrigin = (
    source.LAX_ACCOUNT_PUBLIC_ORIGIN ??
    (source.NODE_ENV === "production" ? "https://account.lax.bid" : "http://localhost:3040")
  ).replace(/\/+$/, "");
  const oidcIssuer = (source.OIDC_ISSUER_URL ?? source.NEXT_PUBLIC_AUTH_URL)?.replace(/\/+$/, "");
  if (!oidcIssuer) throw new Error("OIDC_ISSUER_URL is required for account portal");
  const parsed = configSchema.safeParse({
    NODE_ENV: source.NODE_ENV ?? "development",
    publicOrigin,
    oidcIssuer,
    oidcInternalIssuer: (source.OIDC_INTERNAL_BASE_URL ?? oidcIssuer).replace(/\/+$/, ""),
    oidcClientId: source.OIDC_CLIENT_ID ?? REGISTERED_OIDC_CLIENT_IDS.LAX_ACCOUNT_WEB,
    oidcClientSecret: source.OIDC_CLIENT_SECRET_LAX_ACCOUNT_WEB,
    redisUrl: source.REDIS_URL ?? "redis://127.0.0.1:6379",
    sessionEncryptionKey: source.LAX_ACCOUNT_SESSION_ENCRYPTION_KEY,
    sessionTtlSeconds: source.LAX_ACCOUNT_SESSION_TTL_SECONDS ?? "604800",
    bidPublicUrl: source.LAX_BID_PUBLIC_URL?.trim().replace(/\/+$/, "") || undefined,
    shopAdminUrl:
      (source.LAX_SHOP_ADMIN_URL ?? source.SHOP_ADMIN_URL)?.trim().replace(/\/+$/, "") || undefined,
  });
  if (!parsed.success) {
    console.error(parsed.error.flatten());
    throw new Error("Invalid LAX Account environment");
  }
  return parsed.data;
}
