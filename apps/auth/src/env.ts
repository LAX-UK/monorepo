import { Buffer } from "node:buffer";
import { z } from "zod";

function emptyToUndefined(val: unknown): unknown {
  return val === "" || val === null ? undefined : val;
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
    APP_ENV: z.enum(["production", "test", "development"]).default("development"),
    PORT: z.coerce.number().default(3003),
    DATABASE_URL: z.string().min(1),
    DATABASE_URL_AUTH: z.preprocess(emptyToUndefined, z.string().optional()),
    REDIS_URL: z.string().default("redis://127.0.0.1:6379"),
    BETTER_AUTH_SECRET: z.string().min(16),
    API_PUBLIC_URL: z.string().url().default("http://localhost:3003"),
    OIDC_ISSUER_URL: z.string().url().default("http://localhost:3003"),
    WEB_ORIGIN: z.string().url().default("http://localhost:3000"),
    WEB_ORIGINS: z.preprocess((val) => {
      let source = val;
      if (source === undefined || source === "" || source == null) {
        source = process.env.CORS_ALLOWED_ORIGINS;
      }
      if (source === undefined || source === "" || source == null) return undefined;
      if (typeof source !== "string") return undefined;
      const parts = source
        .split(",")
        .map((s) => s.trim())
        .filter((s) => s.length > 0);
      return parts.length > 0 ? parts : undefined;
    }, z.array(z.string().url()).optional()),
    JWT_AUDIENCE: z.preprocess(emptyToUndefined, z.string().min(1).optional()),
    AUTH_DEK_KEY: z.preprocess(emptyToUndefined, z.string().min(1).optional()),
    METRICS_TOKEN: z.preprocess(emptyToUndefined, z.string().min(16).optional()),
    COOKIE_DOMAIN: z.preprocess(emptyToUndefined, z.string().optional()),
    ALLOW_HTTP_COOKIES: z
      .preprocess((val) => val === "true" || val === true, z.boolean())
      .default(false),
    LOG_LEVEL: z.enum(["fatal", "error", "warn", "info", "debug", "trace"]).default("info"),
    SENTRY_DSN_AUTH: z.preprocess(emptyToUndefined, z.string().url().optional()),
    EMAIL_PROVIDER: z.enum(["console", "postmark"]).default("console"),
    EMAIL_FROM: z.string().default("LAX.BID by London Art Exchange <no-reply@mail.lax.bid>"),
    EMAIL_REPLY_TO: z.preprocess(emptyToUndefined, z.string().optional()),
    POSTMARK_SERVER_TOKEN: z.preprocess(emptyToUndefined, z.string().optional()),
    POSTMARK_TRANSACTIONAL_STREAM: z.string().default("outbound"),
    POSTMARK_BROADCAST_STREAM: z.string().default("broadcast"),
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
    APPLE_DOMAIN_ASSOCIATION: z.preprocess(emptyToUndefined, z.string().optional()),
    TURNSTILE_SECRET_KEY: z.preprocess(emptyToUndefined, z.string().min(1).optional()),
  })
  .superRefine((e, ctx) => {
    if (e.EMAIL_PROVIDER === "postmark" && !e.POSTMARK_SERVER_TOKEN) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "POSTMARK_SERVER_TOKEN is required when EMAIL_PROVIDER=postmark",
      });
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
      for (const u of [e.WEB_ORIGIN, e.API_PUBLIC_URL, e.OIDC_ISSUER_URL]) {
        if (u.includes("localhost") || u.includes("127.0.0.1")) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: `URL must not reference localhost in NODE_ENV=production: ${u}`,
          });
        }
      }
      if (e.WEB_ORIGINS) {
        for (const u of e.WEB_ORIGINS) {
          if (u.includes("localhost") || u.includes("127.0.0.1")) {
            ctx.addIssue({
              code: z.ZodIssueCode.custom,
              message: `WEB_ORIGINS must not reference localhost in production: ${u}`,
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
