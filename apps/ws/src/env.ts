import { z } from "zod";

export const envSchema = z.object({
  NODE_ENV: z.enum(["development", "production", "test"]).default("development"),
  PORT: z.coerce.number().default(3002),
  REDIS_URL: z.string().default("redis://127.0.0.1:6379"),
  API_URL: z.string().url().default("http://localhost:3001"),
  OIDC_ISSUER_URL: z.string().url().default("http://localhost:3003"),
  OIDC_INTERNAL_BASE_URL: z.string().url().optional(),
  CORS_ORIGIN: z.string().default("http://localhost:3000"),
  LOG_LEVEL: z.enum(["fatal", "error", "warn", "info", "debug", "trace"]).default("info"),
  SENTRY_DSN_WS: z.preprocess((val) => (val === "" ? undefined : val), z.string().url().optional()),
});

export type WsEnv = z.infer<typeof envSchema>;

export function loadWsEnv(): WsEnv {
  const parsed = envSchema.safeParse(process.env);
  if (!parsed.success) {
    console.error(parsed.error.flatten());
    throw new Error("Invalid WS environment variables");
  }
  return parsed.data;
}
