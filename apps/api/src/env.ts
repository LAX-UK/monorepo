import { Buffer } from "node:buffer";
import { z } from "zod";

/** Docker Compose uses `VAR=` for unset substitutions, which is `""`, not missing. */
function emptyToUndefined(val: unknown): unknown {
  if (val === "" || val === null) return undefined;
  return val;
}

function trimEmptyToUndefined(val: unknown): unknown {
  if (val === "" || val === null) return undefined;
  if (typeof val === "string") {
    let t = val.trim();
    if (t.length >= 2) {
      const first = t[0];
      const last = t[t.length - 1];
      if ((first === '"' && last === '"') || (first === "'" && last === "'")) {
        t = t.slice(1, -1).trim();
      }
    }
    return t === "" ? undefined : t;
  }
  return val;
}

function validateAuthDekKey(raw: string): string | null {
  const trimmed = raw.trim();
  if (/^[0-9a-fA-F]{64}$/.test(trimmed)) return null;
  try {
    const b64 = trimmed.replace(/-/g, "+").replace(/_/g, "/");
    const pad = b64.length % 4 === 0 ? "" : "=".repeat(4 - (b64.length % 4));
    const buf = Buffer.from(b64 + pad, "base64");
    if (buf.length !== 32) return "AUTH_DEK_KEY must decode to exactly 32 bytes";
    return null;
  } catch {
    return "Invalid AUTH_DEK_KEY encoding";
  }
}

const envSchema = z
  .object({
    NODE_ENV: z.enum(["development", "production", "test"]).default("development"),
    /** Deployment environment for financial / ops validation. Decoupled from NODE_ENV so that the
     * test stack can run with NODE_ENV=production (Node.js optimisations) but sk_test_ keys. */
    APP_ENV: z.enum(["production", "test", "development"]).default("development"),
    PORT: z.coerce.number().default(3001),
    DATABASE_URL: z.string().min(1),
    REDIS_URL: z.string().default("redis://127.0.0.1:6379"),
    BETTER_AUTH_SECRET: z.string().min(16),
    API_PUBLIC_URL: z.string().url().default("http://localhost:3001"),
    OIDC_ISSUER_URL: z.preprocess(emptyToUndefined, z.string().url().optional()),
    WEB_ORIGIN: z.string().url().default("http://localhost:3000"),
    /** Comma-separated extra browser origins allowed for CORS (e.g. `https://lax.art,https://lax.shop`). */
    WEB_ORIGINS: z.preprocess((val) => {
      if (val === undefined || val === "" || val == null) return undefined;
      if (typeof val !== "string") return undefined;
      const parts = val
        .split(",")
        .map((s) => s.trim())
        .filter((s) => s.length > 0);
      return parts.length > 0 ? parts : undefined;
    }, z.array(z.string().url()).optional()),
    /** Extra origins allowed for verify-origin (SSR may send a different host than WEB_ORIGIN). */
    SSR_TRUSTED_ORIGINS: z.preprocess((val) => {
      if (val === undefined || val === "" || val == null) return undefined;
      if (typeof val !== "string") return undefined;
      const parts = val
        .split(",")
        .map((s) => s.trim())
        .filter((s) => s.length > 0);
      return parts.length > 0 ? parts : undefined;
    }, z.array(z.string().url()).optional()),
    JWT_AUDIENCE: z.preprocess(emptyToUndefined, z.string().min(1).optional()),
    /** Same 32-byte DEK as the auth issuer (64 hex or base64). Required in NODE_ENV=production. */
    AUTH_DEK_KEY: z.preprocess(emptyToUndefined, z.string().min(1).optional()),
    /** Cloudflare Turnstile secret; when set, register + forgot-password require `turnstileToken`. */
    TURNSTILE_SECRET_KEY: z.preprocess(trimEmptyToUndefined, z.string().min(1).optional()),
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
    EMAIL_PROVIDER: z.enum(["console", "postmark"]).default("console"),
    EMAIL_FROM: z.string().default("LAX.BID by London Art Exchange <no-reply@mail.lax.bid>"),
    EMAIL_REPLY_TO: z.preprocess(emptyToUndefined, z.string().optional()),
    POSTMARK_SERVER_TOKEN: z.preprocess(emptyToUndefined, z.string().optional()),
    POSTMARK_TRANSACTIONAL_STREAM: z.string().default("outbound"),
    POSTMARK_BROADCAST_STREAM: z.string().default("broadcast"),
    POSTMARK_WEBHOOK_BASIC_AUTH: z.preprocess(emptyToUndefined, z.string().optional()),
    EMAIL_UNSUBSCRIBE_SECRET: z.string().min(16).default("dev-email-unsubscribe-secret"),
    REQUIRE_EMAIL_VERIFICATION: z
      .preprocess((val) => {
        if (val === undefined || val === "") return true;
        return val === "true" || val === true;
      }, z.boolean())
      .default(true),
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
    ENABLE_WHATSAPP_CHANNEL: z
      .preprocess((val) => val === "true" || val === true, z.boolean())
      .default(false),
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
    /** use one Xero Contact per buyer `legal_entity` (stored on `legal_entity.xero_contact_id`)
     * instead of creating contacts from winner email only.
     */
    XERO_USE_LEGAL_ENTITY_CONTACT: z
      .preprocess((val) => val === "true" || val === true, z.boolean())
      .default(false),
    /** chart account for supplier bill line items (ACCPAY) created from paid payouts. */
    XERO_PAYOUT_BILL_ACCOUNT_CODE: z.string().min(1).default("400"),
    /** After OAuth, redirect browser here (web app), e.g. https://app.example.com/admin/integrations/xero */
    XERO_POST_CONNECT_WEB_REDIRECT: z.preprocess(emptyToUndefined, z.string().url().optional()),
    /** Optional outbound email hook for invitations (JSON POST). If unset, invite emails are logged only.
     * Expected to accept payloads like: { to, subject, text }.
     */
    INVITE_EMAIL_WEBHOOK_URL: z.preprocess(emptyToUndefined, z.string().url().optional()),
    INVITE_EMAIL_FROM: z.preprocess(emptyToUndefined, z.string().min(3).optional()),
    /** Stripe secret key (sk_test_… / sk_live_…). Optional until KYC enabled. */
    STRIPE_SECRET_KEY: z.preprocess(trimEmptyToUndefined, z.string().optional()),
    /** Stripe publishable key (pk_test_… / pk_live_…). Public for client SDK. */
    STRIPE_PUBLISHABLE_KEY: z.preprocess(trimEmptyToUndefined, z.string().optional()),
    /** Veriff API key (X-AUTH-CLIENT). Optional until KYC enabled. */
    VERIFF_API_KEY: z.preprocess(trimEmptyToUndefined, z.string().optional()),
    /** Veriff shared secret for webhook HMAC verification. */
    VERIFF_SHARED_SECRET: z.preprocess(emptyToUndefined, z.string().optional()),
    /** Veriff API base URL (sandbox and production use stationapi.veriff.com). */
    VERIFF_API_BASE_URL: z.preprocess(
      emptyToUndefined,
      z.string().url().default("https://stationapi.veriff.com"),
    ),
    /** Stripe Connect webhook signing secret (whsec_…). */
    STRIPE_CONNECT_WEBHOOK_SECRET: z.preprocess(emptyToUndefined, z.string().optional()),
    /** Stripe Payments webhook signing secret (whsec_…) for disputes/refunds. */
    STRIPE_PAYMENTS_WEBHOOK_SECRET: z.preprocess(emptyToUndefined, z.string().optional()),
    /** Stripe Transfers webhook signing secret (whsec_…) for platform transfer events. */
    STRIPE_TRANSFERS_WEBHOOK_SECRET: z.preprocess(emptyToUndefined, z.string().optional()),
    /** Threshold (in major currency units, e.g. 1000.00 for £1000) at which KYC is required for buyer exposure. */
    KYC_THRESHOLD_AMOUNT: z.coerce.number().nonnegative().default(1000),
    /** ISO currency code for KYC threshold comparisons (e.g. GBP). */
    KYC_THRESHOLD_CURRENCY: z.string().min(3).max(3).default("GBP"),
    /** Shared secret for worker → API internal cron routes (`X-Cron-Secret` header).
     * Optional until bulk jobs are enabled in deploy.
     */
    CRON_INTERNAL_SECRET: z.preprocess(emptyToUndefined, z.string().min(24).optional()),
    /** Days before `pending` buyer payments auto-expire (cron). */
    PAYMENT_PENDING_EXPIRE_DAYS: z.coerce.number().int().min(1).max(365).default(14),
    /** Emergency: reject new bids with 503. */
    DISABLE_BIDDING: z.preprocess((v) => v === "true" || v === true, z.boolean()).default(false),
    /** Block `POST /users/register` (public sign-up). */
    DISABLE_NEW_USER_REGISTRATION: z
      .preprocess((v) => v === "true" || v === true, z.boolean())
      .default(false),
    /** Skip Stripe transfer initiation inside bulk payout settlement cron. */
    DISABLE_PAYOUT_SETTLEMENT: z
      .preprocess((v) => v === "true" || v === true, z.boolean())
      .default(false),
    /** When true, admin lot/sale inventory APIs reject new non-English `auction_type` values (DB enum unchanged). */
    ENGLISH_ONLY_AUCTIONS: z
      .preprocess((v) => v === "true" || v === true, z.boolean())
      .default(true),
    /** Platform org entity stamped on staff-created sales (`created_by_legal_entity_id`). Falls back to DB lookup when unset. */
    PLATFORM_CATALOG_LEGAL_ENTITY_ID: z.preprocess(emptyToUndefined, z.string().uuid().optional()),
    /** Support inbox for money-path alerts and ops (required in production). */
    OPS_SUPPORT_EMAIL: z.preprocess(emptyToUndefined, z.string().email().optional()),
    /** On-call / escalation inbox (required in production). */
    OPS_ONCALL_EMAIL: z.preprocess(emptyToUndefined, z.string().email().optional()),
    /** Server-side GTM tagging endpoint (e.g. https://gtm.lax.bid). Prod-only marketing events. */
    SGTM_ENDPOINT_URL: z.preprocess(emptyToUndefined, z.string().url().optional()),
    /** Meta Pixel ID for Conversions API. */
    META_PIXEL_ID: z.preprocess(trimEmptyToUndefined, z.string().optional()),
    /** Meta Conversions API access token. */
    META_CAPI_ACCESS_TOKEN: z.preprocess(trimEmptyToUndefined, z.string().optional()),
    /** Optional Meta test event code (Events Manager validation). */
    META_CAPI_TEST_EVENT_CODE: z.preprocess(trimEmptyToUndefined, z.string().optional()),
    /** GA4 measurement ID for sGTM Measurement Protocol publisher. */
    GA4_MEASUREMENT_ID: z.preprocess(trimEmptyToUndefined, z.string().optional()),
    /** Meta Graph API version for CAPI (default v21.0). */
    META_GRAPH_API_VERSION: z.preprocess(trimEmptyToUndefined, z.string().optional()),
  })
  .superRefine((e, ctx) => {
    if (e.EMAIL_PROVIDER === "postmark" && !e.POSTMARK_SERVER_TOKEN) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "POSTMARK_SERVER_TOKEN is required when EMAIL_PROVIDER=postmark",
      });
    }
    if (e.NODE_ENV === "production" && !e.POSTMARK_WEBHOOK_BASIC_AUTH) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "POSTMARK_WEBHOOK_BASIC_AUTH is required when NODE_ENV=production",
      });
    }
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

    const appEnv = e.APP_ENV;

    // Stripe key format — enforced per deployment environment.
    // production: live keys required. test: test keys required (prevents accidental live key use).
    if (appEnv === "production") {
      const stripeSk = e.STRIPE_SECRET_KEY;
      if (!stripeSk || !stripeSk.startsWith("sk_live_")) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "STRIPE_SECRET_KEY is required in production and must start with sk_live_",
          path: ["STRIPE_SECRET_KEY"],
        });
      }
      const stripePk = e.STRIPE_PUBLISHABLE_KEY;
      if (!stripePk || !stripePk.startsWith("pk_live_")) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "STRIPE_PUBLISHABLE_KEY is required in production and must start with pk_live_",
          path: ["STRIPE_PUBLISHABLE_KEY"],
        });
      }
      for (const [key, val] of [
        ["STRIPE_CONNECT_WEBHOOK_SECRET", e.STRIPE_CONNECT_WEBHOOK_SECRET] as const,
        ["STRIPE_TRANSFERS_WEBHOOK_SECRET", e.STRIPE_TRANSFERS_WEBHOOK_SECRET] as const,
        ["STRIPE_PAYMENTS_WEBHOOK_SECRET", e.STRIPE_PAYMENTS_WEBHOOK_SECRET] as const,
      ]) {
        if (!val || !val.startsWith("whsec_")) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: `${key} is required in production and must start with whsec_`,
            path: [key],
          });
        }
      }
    } else if (appEnv === "test") {
      if (e.STRIPE_SECRET_KEY && !e.STRIPE_SECRET_KEY.startsWith("sk_test_")) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "STRIPE_SECRET_KEY in test must use a test key (sk_test_…)",
          path: ["STRIPE_SECRET_KEY"],
        });
      }
      if (e.STRIPE_PUBLISHABLE_KEY && !e.STRIPE_PUBLISHABLE_KEY.startsWith("pk_test_")) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "STRIPE_PUBLISHABLE_KEY in test must use a test key (pk_test_…)",
          path: ["STRIPE_PUBLISHABLE_KEY"],
        });
      }
    }

    // CRON secret required for all deployed environments (prevents misconfigured cron jobs).
    if (appEnv !== "development") {
      const cron = e.CRON_INTERNAL_SECRET;
      if (!cron || cron.length < 32) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "CRON_INTERNAL_SECRET is required in deployed environments (min 32 characters)",
          path: ["CRON_INTERNAL_SECRET"],
        });
      }
    }

    if (e.NODE_ENV === "production") {
      if (e.ALLOW_HTTP_COOKIES) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "ALLOW_HTTP_COOKIES must be false in NODE_ENV=production",
          path: ["ALLOW_HTTP_COOKIES"],
        });
      }
      if (e.BETTER_AUTH_SECRET.length < 48) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "BETTER_AUTH_SECRET must be at least 48 characters in NODE_ENV=production",
          path: ["BETTER_AUTH_SECRET"],
        });
      }
      const originChecks: string[] = [e.WEB_ORIGIN, e.API_PUBLIC_URL];
      if (e.OIDC_ISSUER_URL) originChecks.push(e.OIDC_ISSUER_URL);
      for (const u of originChecks) {
        if (u.includes("localhost") || u.includes("127.0.0.1")) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: `URL must not reference localhost/127.0.0.1 in NODE_ENV=production: ${u}`,
          });
        }
      }
      if (e.WEB_ORIGINS) {
        for (const u of e.WEB_ORIGINS) {
          if (u.includes("localhost") || u.includes("127.0.0.1")) {
            ctx.addIssue({
              code: z.ZodIssueCode.custom,
              message: `WEB_ORIGINS must not reference localhost in NODE_ENV=production: ${u}`,
              path: ["WEB_ORIGINS"],
            });
          }
        }
      }
      if (!e.AUTH_DEK_KEY?.trim()) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "AUTH_DEK_KEY is required in NODE_ENV=production",
          path: ["AUTH_DEK_KEY"],
        });
      } else {
        const dekErr = validateAuthDekKey(e.AUTH_DEK_KEY);
        if (dekErr) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: dekErr,
            path: ["AUTH_DEK_KEY"],
          });
        }
      }
    }

    // Ops contacts required only in production (test stack uses debug channels).
    if (appEnv === "production") {
      if (!e.OPS_SUPPORT_EMAIL) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "OPS_SUPPORT_EMAIL is required in production",
          path: ["OPS_SUPPORT_EMAIL"],
        });
      }
      if (!e.OPS_ONCALL_EMAIL) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "OPS_ONCALL_EMAIL is required in production",
          path: ["OPS_ONCALL_EMAIL"],
        });
      }
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
