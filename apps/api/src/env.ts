import { z } from "zod";

/** Docker Compose uses `VAR=` for unset substitutions, which is `""`, not missing. */
function emptyToUndefined(val: unknown): unknown {
  if (val === "" || val === null) return undefined;
  return val;
}

const envSchema = z
  .object({
    NODE_ENV: z.enum(["development", "production", "test"]).default("development"),
    PORT: z.coerce.number().default(3001),
    DATABASE_URL: z.string().min(1),
    REDIS_URL: z.string().default("redis://127.0.0.1:6379"),
    BETTER_AUTH_SECRET: z.string().min(16),
    API_PUBLIC_URL: z.string().url().default("http://localhost:3001"),
    OIDC_ISSUER_URL: z.preprocess(emptyToUndefined, z.string().url().optional()),
    WEB_ORIGIN: z.string().url().default("http://localhost:3000"),
    COOKIE_DOMAIN: z.preprocess(emptyToUndefined, z.string().optional()),
    DATABASE_URL_AUTH: z.preprocess(emptyToUndefined, z.string().optional()),
    DATABASE_URL_API: z.preprocess(emptyToUndefined, z.string().optional()),
    VERIFY_ORIGIN: z.preprocess((val) => {
      if (val === undefined || val === "") return false;
      return val === "true" || val === true;
    }, z.boolean()),
    /** Allow auth cookies over HTTP (insecure). Only for testing without HTTPS! */
    ALLOW_HTTP_COOKIES: z.preprocess((val) => {
      if (val === undefined || val === "") return false;
      return val === "true" || val === true;
    }, z.boolean()),
    LOG_LEVEL: z.enum(["fatal", "error", "warn", "info", "debug", "trace"]).default("info"),
    SENTRY_DSN_API: z.preprocess(emptyToUndefined, z.string().url().optional()),
    GOOGLE_CLIENT_ID: z.preprocess(emptyToUndefined, z.string().optional()),
    GOOGLE_CLIENT_SECRET: z.preprocess(emptyToUndefined, z.string().optional()),
    APPLE_CLIENT_ID: z.preprocess(emptyToUndefined, z.string().optional()),
    APPLE_CLIENT_SECRET: z.preprocess(emptyToUndefined, z.string().optional()),
    APPLE_TEAM_ID: z.preprocess(emptyToUndefined, z.string().optional()),
    APPLE_KEY_ID: z.preprocess(emptyToUndefined, z.string().optional()),
    APPLE_PRIVATE_KEY: z.preprocess(emptyToUndefined, z.string().optional()),
    SHOPIFY_WEBHOOK_SECRET: z.preprocess(emptyToUndefined, z.string().optional()),
    WORDPRESS_WEBHOOK_SECRET: z.preprocess(emptyToUndefined, z.string().optional()),
    /** Web Push (optional). When all three are set, server push is enabled. */
    VAPID_PUBLIC_KEY: z.string().optional(),
    VAPID_PRIVATE_KEY: z.string().optional(),
    VAPID_SUBJECT: z.string().optional(),
    STORAGE_DRIVER: z.enum(["local", "s3"]).default("local"),
    /** Directory under process.cwd() for local object storage. */
    STORAGE_LOCAL_ROOT: z.string().default("uploads"),
    S3_BUCKET: z.string().optional(),
    S3_REGION: z.string().optional(),
    S3_ENDPOINT: z.preprocess(emptyToUndefined, z.string().url().optional()),
    S3_ACCESS_KEY_ID: z.string().optional(),
    S3_SECRET_ACCESS_KEY: z.string().optional(),
    /** Public URL prefix for objects (e.g. https://cdn.example.com or R2 public bucket URL). */
    S3_PUBLIC_BASE_URL: z.preprocess(emptyToUndefined, z.string().url().optional()),
    /** public keeps CDN/object URLs; signed returns short-lived presigned GET URLs for owned keys. */
    STORAGE_READ_MODE: z.enum(["public", "signed"]).default("public"),
    SIGNED_GET_TTL_SEC: z.coerce.number().int().min(60).max(86_400).default(900),
    /** Xero OAuth app (optional). When set with secret + redirect, admins can connect Xero. */
    XERO_CLIENT_ID: z.string().optional(),
    XERO_CLIENT_SECRET: z.string().optional(),
    /** Must match a redirect URI registered in the Xero developer portal (e.g. https://api.example.com/admin/integrations/xero/callback). */
    XERO_REDIRECT_URI: z.preprocess(emptyToUndefined, z.string().url().optional()),
    /** Webhook signing key from Xero (optional until webhooks are configured). */
    XERO_WEBHOOK_KEY: z.string().optional(),
    /** Chart of accounts revenue code for invoice line items (org-specific). */
    XERO_DEFAULT_REVENUE_ACCOUNT_CODE: z.string().min(1).default("200"),
    /** Xero tax type for line items (e.g. OUTPUT2, NONE). Org-specific. */
    XERO_DEFAULT_TAX_TYPE: z.string().min(1).default("NONE"),
    /** Days after invoice date for due date. */
    XERO_INVOICE_DUE_DAYS: z.coerce.number().int().min(0).max(365).default(14),
    /** After OAuth, redirect browser here (web app), e.g. https://app.example.com/admin/integrations/xero */
    XERO_POST_CONNECT_WEB_REDIRECT: z.preprocess(emptyToUndefined, z.string().url().optional()),
    /**
     * Optional outbound email hook for invitations (JSON POST). If unset, invite emails are logged only.
     * Expected to accept payloads like: { to, subject, text }.
     */
    INVITE_EMAIL_WEBHOOK_URL: z.preprocess(emptyToUndefined, z.string().url().optional()),
    INVITE_EMAIL_FROM: z.preprocess(emptyToUndefined, z.string().min(3).optional()),
  })
  .superRefine((e, ctx) => {
    if (e.STORAGE_DRIVER === "s3") {
      if (!e.S3_BUCKET || !e.S3_REGION || !e.S3_ACCESS_KEY_ID || !e.S3_SECRET_ACCESS_KEY) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message:
            "S3_BUCKET, S3_REGION, S3_ACCESS_KEY_ID, and S3_SECRET_ACCESS_KEY are required when STORAGE_DRIVER=s3",
        });
      }
    }
    const hasXeroId = Boolean(e.XERO_CLIENT_ID && e.XERO_CLIENT_ID.length > 0);
    const hasXeroSecret = Boolean(e.XERO_CLIENT_SECRET && e.XERO_CLIENT_SECRET.length > 0);
    const hasXeroRedirect = Boolean(e.XERO_REDIRECT_URI);
    if (hasXeroId || hasXeroSecret || hasXeroRedirect) {
      if (!hasXeroId || !hasXeroSecret || !hasXeroRedirect) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message:
            "XERO_CLIENT_ID, XERO_CLIENT_SECRET, and XERO_REDIRECT_URI must all be set together when enabling Xero OAuth",
        });
      }
    }
    const hasGoogleId = Boolean(e.GOOGLE_CLIENT_ID);
    const hasGoogleSecret = Boolean(e.GOOGLE_CLIENT_SECRET);
    if (hasGoogleId !== hasGoogleSecret) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET must be set together",
      });
    }
    const hasAppleId = Boolean(e.APPLE_CLIENT_ID);
    const hasAppleSecret = Boolean(e.APPLE_CLIENT_SECRET);
    if (hasAppleId !== hasAppleSecret) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message:
          "APPLE_CLIENT_ID and APPLE_CLIENT_SECRET must be set together; leave both empty to feature-flag Apple off",
      });
    }
  });

export type Env = z.infer<typeof envSchema>;

export function loadEnv(): Env {
  const parsed = envSchema.safeParse(process.env);
  if (!parsed.success) {
    console.error(parsed.error.flatten());
    throw new Error("Invalid environment variables");
  }
  return parsed.data;
}
