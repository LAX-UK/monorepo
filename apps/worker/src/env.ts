import { z } from "zod";

function emptyToUndefined(val: unknown): unknown {
  return val === "" || val === null ? undefined : val;
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
  })
  .superRefine((e, ctx) => {
    if (e.EMAIL_PROVIDER === "postmark" && !e.POSTMARK_SERVER_TOKEN) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "POSTMARK_SERVER_TOKEN is required when EMAIL_PROVIDER=postmark",
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
    }
  });

export type WorkerEnv = z.infer<typeof envSchema>;

export function loadWorkerEnv(): WorkerEnv {
  const parsed = envSchema.safeParse(process.env);
  if (!parsed.success) {
    console.error(parsed.error.flatten());
    throw new Error("Invalid worker environment variables");
  }
  return parsed.data;
}
