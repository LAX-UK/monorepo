import { z } from "zod";

function emptyToUndefined(val: unknown): unknown {
  return val === "" || val === null ? undefined : val;
}

const envSchema = z.object({
  NODE_ENV: z.enum(["development", "production", "test"]).default("development"),
  PORT: z.coerce.number().default(3003),
  DATABASE_URL: z.string().min(1),
  DATABASE_URL_AUTH: z.preprocess(emptyToUndefined, z.string().optional()),
  BETTER_AUTH_SECRET: z.string().min(16),
  API_PUBLIC_URL: z.string().url().default("http://localhost:3003"),
  OIDC_ISSUER_URL: z.string().url().default("http://localhost:3003"),
  WEB_ORIGIN: z.string().url().default("http://localhost:3000"),
  COOKIE_DOMAIN: z.preprocess(emptyToUndefined, z.string().optional()),
  ALLOW_HTTP_COOKIES: z
    .preprocess((val) => val === "true" || val === true, z.boolean())
    .default(false),
  LOG_LEVEL: z.enum(["fatal", "error", "warn", "info", "debug", "trace"]).default("info"),
  SENTRY_DSN_AUTH: z.preprocess(emptyToUndefined, z.string().url().optional()),
  GOOGLE_CLIENT_ID: z.preprocess(emptyToUndefined, z.string().optional()),
  GOOGLE_CLIENT_SECRET: z.preprocess(emptyToUndefined, z.string().optional()),
  APPLE_CLIENT_ID: z.preprocess(emptyToUndefined, z.string().optional()),
  APPLE_CLIENT_SECRET: z.preprocess(emptyToUndefined, z.string().optional()),
  APPLE_DOMAIN_ASSOCIATION: z.preprocess(emptyToUndefined, z.string().optional()),
});

export type AuthAppEnv = z.infer<typeof envSchema>;

export function loadAuthEnv(): AuthAppEnv {
  const parsed = envSchema.safeParse(process.env);
  if (!parsed.success) {
    console.error(parsed.error.flatten());
    throw new Error("Invalid auth app environment variables");
  }
  return parsed.data;
}
