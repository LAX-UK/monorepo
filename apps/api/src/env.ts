import { z } from "zod";

const envSchema = z
  .object({
    NODE_ENV: z.enum(["development", "production", "test"]).default("development"),
    PORT: z.coerce.number().default(3001),
    DATABASE_URL: z.string().min(1),
    REDIS_URL: z.string().default("redis://127.0.0.1:6379"),
    BETTER_AUTH_SECRET: z.string().min(16),
    API_PUBLIC_URL: z.string().url().default("http://localhost:3001"),
    WEB_ORIGIN: z.string().url().default("http://localhost:3000"),
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
    /** Web Push (optional). When all three are set, server push is enabled. */
    VAPID_PUBLIC_KEY: z.string().optional(),
    VAPID_PRIVATE_KEY: z.string().optional(),
    VAPID_SUBJECT: z.string().optional(),
    STORAGE_DRIVER: z.enum(["local", "s3"]).default("local"),
    /** Directory under process.cwd() for local object storage. */
    STORAGE_LOCAL_ROOT: z.string().default("uploads"),
    S3_BUCKET: z.string().optional(),
    S3_REGION: z.string().optional(),
    S3_ENDPOINT: z.string().url().optional(),
    S3_ACCESS_KEY_ID: z.string().optional(),
    S3_SECRET_ACCESS_KEY: z.string().optional(),
    /** Public URL prefix for objects (e.g. https://cdn.example.com or R2 public bucket URL). */
    S3_PUBLIC_BASE_URL: z.string().url().optional(),
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
