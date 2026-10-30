import { legalEntityFor } from "@auction/branding";
import { STAFF_STEP_UP_MAX_AGE_SECONDS } from "@auction/identity-contracts";
import { parseFinancialYearEnd } from "@auction/shop-domain";
import { z } from "zod";

type AppEnv = "production" | "test" | "development";

function resolveAppEnv(source: NodeJS.ProcessEnv): AppEnv {
  const raw = source.APP_ENV?.trim();
  if (raw === "production" || raw === "test" || raw === "development") return raw;
  return (source.NODE_ENV ?? "development") === "production" ? "production" : "development";
}

export const shopApiEnvSchema = z.object({
  NODE_ENV: z.enum(["development", "production", "test"]).default("development"),
  PORT: z.coerce.number().default(3011),
  DATABASE_URL_SHOP: z.string().min(1),
  LOG_LEVEL: z.enum(["fatal", "error", "warn", "info", "debug", "trace"]).default("info"),
  METRICS_TOKEN: z.string().optional(),
  SENTRY_DSN_SHOP_API: z.preprocess(
    (val) => (val === "" ? undefined : val),
    z.string().url().optional(),
  ),
  SHOP_API_PUBLIC_BASE_URL: z.string().url().default("http://localhost:3011"),
  SHOP_STOREFRONT_URL: z.string().url().default("http://localhost:3020"),
  LAX_ART_PUBLIC_URL: z.preprocess(
    (val) => (val === "" ? undefined : val),
    z.string().url().optional(),
  ),
  /**
   * Legal entity that owns Shop and lax.art records in the cross-product portfolio (LAX Shop
   * and lax.art are both London Art Exchange Ltd). Override it only if the company changes.
   */
  LAX_ART_LEGAL_NAME: z.string().min(1).default(legalEntityFor("art").name),
  OIDC_ISSUER_URL: z.string().url().default("http://localhost:3001"),
  OIDC_INTERNAL_BASE_URL: z.string().url().optional(),
  SHOP_API_BFF_TOKEN: z.string().min(32).optional(),
  /**
   * The Identity machine client. Identity calls `/internal/identity/...` with it (account
   * deletion asks what the person has in flight). With either unset those routes answer 503.
   */
  IDENTITY_MACHINE_CLIENT_ID: z.preprocess(
    (val) => (val === "" ? undefined : val),
    z.string().min(1).optional(),
  ),
  IDENTITY_MACHINE_CLIENT_SECRET: z.preprocess(
    (val) => (val === "" ? undefined : val),
    z.string().min(32).optional(),
  ),
  /** Shares enquiry rate-limit counters across instances; without it each instance counts alone. */
  REDIS_URL: z.preprocess((val) => (val === "" ? undefined : val), z.string().url().optional()),
  STRIPE_SECRET_KEY: z.preprocess(
    (val) => (val === "" ? undefined : val),
    z.string().min(1).optional(),
  ),
  STRIPE_WEBHOOK_SECRET: z.preprocess(
    (val) => (val === "" ? undefined : val),
    z.string().min(1).optional(),
  ),
  STRIPE_PUBLISHABLE_KEY: z.preprocess(
    (val) => (val === "" ? undefined : val),
    z.string().min(1).optional(),
  ),
  /** Connect endpoint secret (events from connected accounts, e.g. `account.updated`). */
  STRIPE_SHOP_CONNECT_WEBHOOK_SECRET: z.preprocess(
    (val) => (val === "" ? undefined : val),
    z.string().min(1).optional(),
  ),
  /**
   * Stripe platform that `STRIPE_SECRET_KEY` belongs to (D38). Keying rows by platform stops
   * connected accounts from one platform being reused on another.
   */
  STRIPE_SHOP_CONNECT_PLATFORM_KEY: z.enum(["lax_art", "bid_sandbox"]).default("bid_sandbox"),
  SHOP_CONNECT_TRANSFERS_ENABLED: z
    .enum(["true", "false"])
    .default("false")
    .transform((value) => value === "true"),
  SHOP_SCHEDULER_ENABLED: z
    .enum(["true", "false"])
    .default("true")
    .transform((value) => value === "true"),
  SHOP_SCHEDULER_INTERVAL_MS: z.coerce.number().int().min(5_000).default(60_000),
  /**
   * The last day of London Art Exchange Ltd's financial year, as "MM-DD". The kept invoice name
   * and address of an erased guest are purged six years after the end of the financial year the
   * invoice falls in. Defaults to 30 September, the company's accounting reference date.
   */
  SHOP_FINANCIAL_YEAR_END: z
    .string()
    .default("09-30")
    .transform((value, ctx) => {
      const parsed = parseFinancialYearEnd(value);
      if (!parsed) {
        ctx.addIssue({
          code: "custom",
          message: "SHOP_FINANCIAL_YEAR_END must be MM-DD, e.g. 09-30",
        });
        return z.NEVER;
      }
      return parsed;
    }),
  SHOP_ENQUIRY_NOTIFICATION_EMAIL: z.preprocess(
    (val) => (val === "" ? undefined : val),
    z.string().email().optional(),
  ),
  SHOP_OPS_ALERT_EMAIL: z.preprocess(
    (val) => (val === "" ? undefined : val),
    z.string().email().optional(),
  ),
  /**
   * London Art Exchange Ltd's VAT registration number, printed on Shop invoices. Until it is set
   * the document is titled "Invoice", not "VAT invoice", because a VAT invoice must carry one.
   */
  SHOP_VAT_REGISTRATION_NUMBER: z.preprocess(
    (val) => (typeof val === "string" && val.trim() === "" ? undefined : val),
    z.string().trim().min(4).max(20).optional(),
  ),
  SHOP_FAKE_CHECKOUT_ENABLED: z
    .enum(["true", "false"])
    .default("false")
    .transform((value) => value === "true"),
  DOMAIN_EVENT_PUBLISH_VALIDATE: z.enum(["off", "observe", "enforce"]).default("observe"),
  SHOP_ADMIN_ENABLED: z
    .enum(["true", "false"])
    .default("false")
    .transform((value) => value === "true"),
  SHOP_PORTAL_OWNERSHIP_ENABLED: z
    .enum(["true", "false"])
    .default("false")
    .transform((value) => value === "true"),
  SHOP_PAYOUTS_ENABLED: z
    .enum(["true", "false"])
    .default("false")
    .transform((value) => value === "true"),
  SHOP_THIRD_PARTY_ENABLED: z
    .enum(["true", "false"])
    .default("false")
    .transform((value) => value === "true"),
  SHOP_ORIGINALS_ENABLED: z
    .enum(["true", "false"])
    .default("false")
    .transform((value) => value === "true"),
  SHOP_MERCHANDISE_ENABLED: z
    .enum(["true", "false"])
    .default("false")
    .transform((value) => value === "true"),
  /**
   * Copies of one edition a single order may hold, shown to shoppers as "Limit N per order".
   * "none" leaves only the stock as the limit.
   */
  SHOP_EDITION_ORDER_LIMIT: z
    .string()
    .default("2")
    .refine((value) => value === "none" || /^[1-9]\d?$/.test(value), {
      message: 'SHOP_EDITION_ORDER_LIMIT must be "none" or a whole number from 1 to 24',
    })
    .transform((value) => (value === "none" ? null : Math.min(Number(value), 24))),
  SHOP_EDITORIAL_ENABLED: z
    .enum(["true", "false"])
    .default("false")
    .transform((value) => value === "true"),
  /** lax.art endpoint that drops cached editorial reads, e.g. https://lax.art/api/revalidate. */
  ART_REVALIDATE_URL: z.preprocess(
    (val) => (val === "" ? undefined : val),
    z.string().url().optional(),
  ),
  /** Shared with lax.art, which authenticates `ART_REVALIDATE_URL` calls by this value. */
  ART_REVALIDATE_SECRET: z.preprocess(
    (val) => (val === "" ? undefined : val),
    z.string().min(32).optional(),
  ),
  /** HMAC secret for draft preview tokens (defaults to SHOP_API_BFF_TOKEN in non-production). */
  SHOP_EDITORIAL_PREVIEW_SECRET: z.preprocess(
    (val) => (val === "" ? undefined : val),
    z.string().min(32).optional(),
  ),
  SHOP_VAT_STANDARD_RATE_BP: z.preprocess(
    (val) => (val === "" || val === undefined ? undefined : Number(val)),
    z.number().int().min(0).max(10_000).optional(),
  ),
  SHOP_CANCELLATION_DAYS_AFTER_POSSESSION: z.preprocess(
    (val) => (val === "" || val === undefined ? undefined : Number(val)),
    z.number().int().min(0).max(365).optional(),
  ),
  SHOP_PERSONALISED_GOODS_CANCELLATION_EXEMPT: z
    .enum(["true", "false"])
    .default("false")
    .transform((value) => value === "true"),
  /** Max seconds since OIDC `auth_time` for finance admin mutations (D31). */
  SHOP_ADMIN_FINANCE_MAX_AUTH_AGE_SECONDS: z.coerce
    .number()
    .int()
    .min(60)
    .max(86_400)
    .default(STAFF_STEP_UP_MAX_AGE_SECONDS),
  SHOP_OPS_FINANCE_CLI_ENABLED: z
    .enum(["true", "false"])
    .default("false")
    .transform((value) => value === "true"),
  SHOP_OPS_DUAL_CONTROL_PENCE: z.coerce.number().int().min(0).default(500_000),
  S3_BUCKET: z.preprocess((val) => (val === "" ? undefined : val), z.string().optional()),
  S3_REGION: z.preprocess((val) => (val === "" ? undefined : val), z.string().optional()),
  S3_ENDPOINT: z.preprocess((val) => (val === "" ? undefined : val), z.string().url().optional()),
  S3_ACCESS_KEY_ID: z.preprocess((val) => (val === "" ? undefined : val), z.string().optional()),
  S3_SECRET_ACCESS_KEY: z.preprocess(
    (val) => (val === "" ? undefined : val),
    z.string().optional(),
  ),
  /** Public CDN base for shop media keys (no trailing slash). */
  SHOP_MEDIA_PUBLIC_BASE_URL: z.preprocess(
    (val) => (val === "" ? undefined : val),
    z.string().url().optional(),
  ),
});

export type ShopApiEnv = z.infer<typeof shopApiEnvSchema>;

export function loadShopApiEnv(source: NodeJS.ProcessEnv = process.env): ShopApiEnv {
  const normalized: NodeJS.ProcessEnv = { ...source };
  if (
    !normalized.DATABASE_URL_SHOP?.trim() &&
    normalized.DATABASE_URL?.trim() &&
    (normalized.NODE_ENV ?? "development") !== "production"
  ) {
    normalized.DATABASE_URL_SHOP = normalized.DATABASE_URL;
  }
  const parsed = shopApiEnvSchema.safeParse(normalized);
  if (!parsed.success) {
    console.error(parsed.error.flatten());
    throw new Error("Invalid Shop API environment variables");
  }
  if (Boolean(parsed.data.ART_REVALIDATE_URL) !== Boolean(parsed.data.ART_REVALIDATE_SECRET)) {
    throw new Error("ART_REVALIDATE_URL and ART_REVALIDATE_SECRET must be set together");
  }
  if (parsed.data.NODE_ENV === "production") {
    if (!parsed.data.SHOP_API_BFF_TOKEN) {
      throw new Error("SHOP_API_BFF_TOKEN is required in production");
    }
    if (!parsed.data.STRIPE_SECRET_KEY) {
      throw new Error("STRIPE_SECRET_KEY is required in production");
    }
    if (!parsed.data.STRIPE_WEBHOOK_SECRET) {
      throw new Error("STRIPE_WEBHOOK_SECRET is required in production");
    }
    if (parsed.data.SHOP_FAKE_CHECKOUT_ENABLED) {
      throw new Error("SHOP_FAKE_CHECKOUT_ENABLED must not be enabled in production");
    }
    if (parsed.data.SHOP_EDITORIAL_ENABLED && !parsed.data.SHOP_EDITORIAL_PREVIEW_SECRET) {
      throw new Error(
        "SHOP_EDITORIAL_PREVIEW_SECRET is required in production when SHOP_EDITORIAL_ENABLED=true",
      );
    }
    if (
      resolveAppEnv(normalized) === "production" &&
      parsed.data.SHOP_PAYOUTS_ENABLED &&
      parsed.data.STRIPE_SHOP_CONNECT_PLATFORM_KEY !== "lax_art"
    ) {
      throw new Error(
        "SHOP_PAYOUTS_ENABLED when APP_ENV=production requires STRIPE_SHOP_CONNECT_PLATFORM_KEY=lax_art",
      );
    }
  }
  return parsed.data;
}
