import {
  REGISTERED_OIDC_CLIENTS,
  REGISTERED_OIDC_CLIENT_IDS,
  type RegisteredOidcClientId,
} from "@auction/identity-contracts";
import { z } from "zod";

/** One shop-identity deployment per storefront hostname (D37): shop.lax.art and www.thelax.art. */
const STOREFRONT_OIDC_CLIENT_IDS = [
  REGISTERED_OIDC_CLIENT_IDS.LAX_SHOP_WEB,
  REGISTERED_OIDC_CLIENT_IDS.LAX_ART_WEB,
] as const;

const envSchema = z
  .object({
    NODE_ENV: z.enum(["development", "production", "test"]).default("development"),
    PORT: z.coerce.number().default(3010),
    OIDC_ISSUER_URL: z.string().url(),
    OIDC_INTERNAL_BASE_URL: z.string().url().optional(),
    OIDC_CLIENT_ID: z.string().min(1),
    OIDC_CLIENT_SECRET: z.string().min(32),
    OIDC_REDIRECT_URI: z.string().url(),
    OIDC_POST_LOGOUT_REDIRECT_URI: z.string().url(),
    SHOP_STOREFRONT_URL: z.string().url().default("http://localhost:3020"),
    SHOP_API_BASE_URL: z.string().url().default("http://localhost:3011"),
    SHOP_API_BFF_TOKEN: z.string().min(32).optional(),
    SHOP_IDENTITY_TOKEN_ENCRYPTION_KEY: z.string().min(1).optional(),
    DATABASE_URL_SHOP: z.string().min(1).optional(),
    DATABASE_URL: z.string().min(1).optional(),
    FEDCM_ENABLED: z
      .preprocess((val) => val === "true" || val === true, z.boolean())
      .default(false),
  })
  .superRefine((env, ctx) => {
    if (!env.DATABASE_URL_SHOP && !env.DATABASE_URL) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "DATABASE_URL_SHOP is required",
        path: ["DATABASE_URL_SHOP"],
      });
    }
    if (env.NODE_ENV === "production" && !env.DATABASE_URL_SHOP) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Production must use the Shop-local DATABASE_URL_SHOP role",
        path: ["DATABASE_URL_SHOP"],
      });
    }
    if (
      env.NODE_ENV === "production" &&
      !(STOREFRONT_OIDC_CLIENT_IDS as readonly string[]).includes(env.OIDC_CLIENT_ID)
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: `Production OIDC_CLIENT_ID must be one of ${STOREFRONT_OIDC_CLIENT_IDS.join(", ")}`,
        path: ["OIDC_CLIENT_ID"],
      });
    }
    const registered = REGISTERED_OIDC_CLIENTS[env.OIDC_CLIENT_ID as RegisteredOidcClientId];
    if (registered && !registered.redirectUris.includes(env.OIDC_REDIRECT_URI)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "OIDC_REDIRECT_URI must be exactly registered for the client",
        path: ["OIDC_REDIRECT_URI"],
      });
    }
    if (
      registered &&
      !registered.postLogoutRedirectUris.includes(env.OIDC_POST_LOGOUT_REDIRECT_URI)
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "OIDC_POST_LOGOUT_REDIRECT_URI must be exactly registered for the client",
        path: ["OIDC_POST_LOGOUT_REDIRECT_URI"],
      });
    }
    if (env.NODE_ENV === "production" && !env.SHOP_API_BFF_TOKEN) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "SHOP_API_BFF_TOKEN is required in production",
        path: ["SHOP_API_BFF_TOKEN"],
      });
    }
    if (env.NODE_ENV === "production" && !env.SHOP_IDENTITY_TOKEN_ENCRYPTION_KEY) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "SHOP_IDENTITY_TOKEN_ENCRYPTION_KEY is required in production",
        path: ["SHOP_IDENTITY_TOKEN_ENCRYPTION_KEY"],
      });
    }
  });

export type ShopIdentityEnv = z.infer<typeof envSchema>;

export function loadShopIdentityEnv(input: NodeJS.ProcessEnv = process.env): ShopIdentityEnv {
  const parsed = envSchema.safeParse(input);
  if (!parsed.success) {
    console.error(parsed.error.flatten());
    throw new Error("Invalid shop identity environment variables");
  }
  return parsed.data;
}
