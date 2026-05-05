import { z } from "zod";

function emptyToUndefined(val: unknown): unknown {
  return val === "" || val === null ? undefined : val;
}

const envSchema = z
  .object({
    NODE_ENV: z.enum(["development", "production", "test"]).default("development"),
    PORT: z.coerce.number().default(3004),
    DATABASE_URL: z.string().min(1),
    DATABASE_URL_WORKER: z.preprocess(emptyToUndefined, z.string().optional()),
    REDIS_URL: z.string().default("redis://127.0.0.1:6379"),
    LOG_LEVEL: z.enum(["fatal", "error", "warn", "info", "debug", "trace"]).default("info"),
    SENTRY_DSN_WORKER: z.preprocess(emptyToUndefined, z.string().url().optional()),
    EMAIL_PROVIDER: z.enum(["console", "postmark"]).default("console"),
    EMAIL_FROM: z.string().default("LAX <no-reply@mail.lax.bid>"),
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
