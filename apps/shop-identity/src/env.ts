import { REGISTERED_OIDC_CLIENTS, type RegisteredOidcClientId } from "@auction/identity-contracts";
import { z } from "zod";

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
    SESSION_SECRET: z.string().min(32),
    DATABASE_URL_SHOP: z.string().min(1).optional(),
    DATABASE_URL: z.string().min(1).optional(),
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
    if (env.NODE_ENV === "production" && env.OIDC_CLIENT_ID !== "lax-shop-web") {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Production OIDC_CLIENT_ID must be lax-shop-web",
        path: ["OIDC_CLIENT_ID"],
      });
    }
    const registered = REGISTERED_OIDC_CLIENTS[env.OIDC_CLIENT_ID as RegisteredOidcClientId];
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
