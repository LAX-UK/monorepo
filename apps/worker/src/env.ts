import { z } from "zod";

function emptyToUndefined(val: unknown): unknown {
  return val === "" || val === null ? undefined : val;
}

function envBoolean(val: unknown): unknown {
  if (val === undefined || val === null || val === "") return undefined;
  return val === "true" || val === true;
}

const envSchema = z
  .object({
    NODE_ENV: z.enum(["development", "production", "test"]).default("development"),
    /** Deployment environment for financial / ops validation — decoupled from NODE_ENV. */
    APP_ENV: z.enum(["production", "test", "development"]).default("development"),
    PORT: z.coerce.number().default(3004),
    DATABASE_URL: z.string().min(1),
    DATABASE_URL_WORKER: z.preprocess(emptyToUndefined, z.string().optional()),
    REDIS_URL: z.string().default("redis://127.0.0.1:6379"),
    LOG_LEVEL: z.enum(["fatal", "error", "warn", "info", "debug", "trace"]).default("info"),
    SENTRY_DSN_WORKER: z.preprocess(emptyToUndefined, z.string().url().optional()),
    EMAIL_PROVIDER: z.enum(["console", "postmark"]).default("console"),
    EMAIL_FROM: z.string().default("LAX.BID by London Art Exchange <no-reply@mail.lax.bid>"),
    EMAIL_REPLY_TO: z.preprocess(emptyToUndefined, z.string().optional()),
    POSTMARK_SERVER_TOKEN: z.preprocess(emptyToUndefined, z.string().optional()),
    POSTMARK_TRANSACTIONAL_STREAM: z.string().default("outbound"),
    POSTMARK_BROADCAST_STREAM: z.string().default("broadcast"),
    ZOHO_API_HOST: z.string().url().default("https://www.zohoapis.eu"),
    ZOHO_ACCOUNTS_HOST: z.string().url().default("https://accounts.zoho.eu"),
    ZOHO_CLIENT_ID: z.preprocess(emptyToUndefined, z.string().optional()),
    ZOHO_CLIENT_SECRET: z.preprocess(emptyToUndefined, z.string().optional()),
    ZOHO_REFRESH_TOKEN: z.preprocess(emptyToUndefined, z.string().optional()),
    ZOHO_CAMPAIGNS_API_KEY: z.preprocess(emptyToUndefined, z.string().optional()),
    ZOHO_CAMPAIGNS_LIST_KEY: z.preprocess(emptyToUndefined, z.string().optional()),
    /** ATG (GAP API) White Label sync — see docs/integrations/atg.md. */
    ATG_SYNC_ENABLED: z.preprocess(envBoolean, z.boolean().default(false)),
    ATG_API_BASE_URL: z.preprocess(
      emptyToUndefined,
      z.string().url().default("https://api.globalauctionplatform.com"),
    ),
    ATG_API_USERNAME: z.preprocess(emptyToUndefined, z.string().optional()),
    ATG_API_PASSWORD: z.preprocess(emptyToUndefined, z.string().optional()),
    ATG_CLIENT_ID: z.preprocess(emptyToUndefined, z.string().uuid().optional()),
    ATG_PLATFORM_CODE: z.preprocess(emptyToUndefined, z.string().optional()),
    ATG_INCREMENT_SET_ID: z.preprocess(emptyToUndefined, z.string().uuid().optional()),
    ATG_DEFAULT_CATEGORY: z.preprocess(emptyToUndefined, z.string().optional()),
    ATG_ARTIST_PLACEMENT: z.preprocess(
      emptyToUndefined,
      z.enum(["title_prefix", "description"]).default("description"),
    ),
    ATG_TIMEZONE: z.preprocess(emptyToUndefined, z.string().default("Europe/London")),
    /** Must stay under the 5-minute worker readiness heartbeat window. */
    ATG_POLL_INTERVAL_MS: z.coerce.number().int().min(30_000).max(240_000).default(120_000),
    /** Interim marketing-contacts ESP for registered-user lifecycle campaigns (Plan B). */
    MARKETING_CONTACT_SYNC_PROVIDER: z.enum(["none", "brevo"]).default("none"),
    BREVO_API_KEY: z.preprocess(emptyToUndefined, z.string().optional()),
    BREVO_LIST_ID: z.preprocess(emptyToUndefined, z.coerce.number().int().positive().optional()),
    STORAGE_DRIVER: z.enum(["local", "s3"]).default("local"),
    STORAGE_LOCAL_ROOT: z.string().default("uploads"),
    S3_BUCKET: z.string().optional(),
    S3_REGION: z.string().optional(),
    S3_ENDPOINT: z.preprocess(emptyToUndefined, z.string().url().optional()),
    S3_ACCESS_KEY_ID: z.string().optional(),
    S3_SECRET_ACCESS_KEY: z.string().optional(),
    S3_PUBLIC_BASE_URL: z.preprocess(emptyToUndefined, z.string().url().optional()),
    /** Footer contact on payout statement PDFs (defaults to EMAIL_REPLY_TO then EMAIL_FROM). */
    PAYOUT_STATEMENT_CONTACT_EMAIL: z.preprocess(emptyToUndefined, z.string().email().optional()),
    /** Base URL for server-side calls into the API (cron jobs). */
    API_INTERNAL_BASE_URL: z.string().url().default("http://127.0.0.1:3001"),
    /** Public API origin used to build persisted object URLs for local disk storage (must match API static upload mount). */
    API_PUBLIC_URL: z.string().url().default("http://127.0.0.1:3001"),
    /** Must match API `CRON_INTERNAL_SECRET` when bulk payout settlement is enabled. */
    CRON_INTERNAL_SECRET: z.preprocess(emptyToUndefined, z.string().min(24).optional()),
    /** Web app origin for constructing admin dashboard URLs in emails. */
    WEB_ORIGIN: z.string().url().default("http://localhost:3000"),
    /** Platform admin email for ops notifications (refunds, disputes, etc.). */
    ADMIN_EMAIL_ADDRESS: z.preprocess(emptyToUndefined, z.string().email().optional()),
    SGTM_ENDPOINT_URL: z.preprocess(emptyToUndefined, z.string().url().optional()),
    META_PIXEL_ID: z.preprocess(emptyToUndefined, z.string().optional()),
    META_CAPI_ACCESS_TOKEN: z.preprocess(emptyToUndefined, z.string().optional()),
    META_CAPI_TEST_EVENT_CODE: z.preprocess(emptyToUndefined, z.string().optional()),
    GA4_MEASUREMENT_ID: z.preprocess(emptyToUndefined, z.string().optional()),
    META_GRAPH_API_VERSION: z.preprocess(emptyToUndefined, z.string().optional()),
    MARKETING_EVENT_WORKER_CONCURRENCY: z.coerce.number().int().min(1).max(50).default(5),
    QR_SCAN_RETENTION_DAYS: z.coerce.number().int().min(1).max(3650).default(90),
    /** Optional ClamAV daemon for SoF document malware scanning. */
    CLAMAV_HOST: z.preprocess(emptyToUndefined, z.string().optional()),
    CLAMAV_PORT: z.coerce.number().int().min(1).max(65535).default(3310),
    /** Optional ClamAV REST endpoint for SoF document malware scanning. */
    CLAMAV_URL: z.preprocess(emptyToUndefined, z.string().url().optional()),
    STRICT_BID_ELIGIBILITY_ENABLED: z.preprocess((val) => {
      if (val === undefined || val === "") return undefined;
      return val === "true" || val === true;
    }, z.boolean().optional()),
  })
  .superRefine((e, ctx) => {
    if (e.EMAIL_PROVIDER === "postmark" && !e.POSTMARK_SERVER_TOKEN) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "POSTMARK_SERVER_TOKEN is required when EMAIL_PROVIDER=postmark",
      });
    }
    if (e.MARKETING_CONTACT_SYNC_PROVIDER === "brevo") {
      if (!e.BREVO_API_KEY || !e.BREVO_LIST_ID) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message:
            "BREVO_API_KEY and BREVO_LIST_ID are required when MARKETING_CONTACT_SYNC_PROVIDER=brevo",
          path: ["MARKETING_CONTACT_SYNC_PROVIDER"],
        });
      }
    }
    if (e.ATG_SYNC_ENABLED) {
      const missing = (
        [
          "ATG_API_USERNAME",
          "ATG_API_PASSWORD",
          "ATG_PLATFORM_CODE",
          "ATG_INCREMENT_SET_ID",
          "ATG_DEFAULT_CATEGORY",
          "S3_PUBLIC_BASE_URL",
        ] as const
      ).filter((key) => !e[key]);
      if (missing.length > 0) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: `${missing.join(", ")} required when ATG_SYNC_ENABLED=true`,
          path: ["ATG_SYNC_ENABLED"],
        });
      }
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
    // CRON secret required for all deployed environments.
    if (e.APP_ENV !== "development") {
      const cron = e.CRON_INTERNAL_SECRET;
      if (!cron || cron.length < 32) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "CRON_INTERNAL_SECRET is required in deployed environments (min 32 characters)",
          path: ["CRON_INTERNAL_SECRET"],
        });
      }
    }
    // Admin email required only in production (test stack uses debug channels).
    if (e.APP_ENV === "production") {
      if (!e.ADMIN_EMAIL_ADDRESS) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "ADMIN_EMAIL_ADDRESS is required in production for ops notifications",
          path: ["ADMIN_EMAIL_ADDRESS"],
        });
      }
      if (!e.CLAMAV_URL && !e.CLAMAV_HOST) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message:
            "CLAMAV_URL or CLAMAV_HOST is required in production for Source-of-Funds malware scanning",
          path: ["CLAMAV_URL"],
        });
      }
    }
  });

export type WorkerEnv = z.infer<typeof envSchema>;

export function loadWorkerEnv(): WorkerEnv {
  const parsed = envSchema.safeParse(process.env);
  if (!parsed.success) {
    console.error(parsed.error.flatten());
    throw new Error("Invalid worker environment variables");
  }
  return {
    ...parsed.data,
    STRICT_BID_ELIGIBILITY_ENABLED:
      parsed.data.STRICT_BID_ELIGIBILITY_ENABLED ?? parsed.data.APP_ENV !== "production",
  };
}
