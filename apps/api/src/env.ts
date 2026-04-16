import { z } from "zod";

const envSchema = z.object({
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
