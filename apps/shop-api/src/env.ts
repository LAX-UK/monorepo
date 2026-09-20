import { z } from "zod";

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
  OIDC_ISSUER_URL: z.string().url().default("http://localhost:3001"),
  OIDC_INTERNAL_BASE_URL: z.string().url().optional(),
  SHOP_API_BFF_TOKEN: z.string().min(32).optional(),
  STRIPE_SECRET_KEY: z.preprocess(
    (val) => (val === "" ? undefined : val),
    z.string().min(1).optional(),
  ),
  STRIPE_WEBHOOK_SECRET: z.preprocess(
    (val) => (val === "" ? undefined : val),
    z.string().min(1).optional(),
  ),
  SHOP_SCHEDULER_ENABLED: z
    .enum(["true", "false"])
    .default("true")
    .transform((value) => value === "true"),
  SHOP_SCHEDULER_INTERVAL_MS: z.coerce.number().int().min(5_000).default(60_000),
  SHOP_ENQUIRY_NOTIFICATION_EMAIL: z.preprocess(
    (val) => (val === "" ? undefined : val),
    z.string().email().optional(),
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
  }
  return parsed.data;
}
