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
    API_INTERNAL_BASE_URL: z.string().url().default("http://127.0.0.1:3001"),
    IDENTITY_EMAIL_ENQUEUE_URL: z.preprocess(emptyToUndefined, z.string().url().optional()),
    IDENTITY_PRODUCT_USAGE_URL: z.preprocess(emptyToUndefined, z.string().url().optional()),
    IDENTITY_EMAIL_ENQUEUE_TIMEOUT_MS: z.coerce.number().int().min(250).max(10_000).default(3_000),
    /**
     * Internal base URL of shop-api. Account deletion asks it what the person has in flight; with
     * none set, deletion is blocked (an unreachable product never counts as "nothing in the way").
     */
    SHOP_API_INTERNAL_BASE_URL: z.preprocess(emptyToUndefined, z.string().url().optional()),
    IDENTITY_DELETION_ELIGIBILITY_TIMEOUT_MS: z.coerce
      .number()
      .int()
      .min(250)
      .max(10_000)
      .default(3_000),
    IDENTITY_SUBJECT_USAGE_TIMEOUT_MS: z.coerce.number().int().min(250).max(10_000).default(1_500),
    REDIS_URL: z.string().default("redis://127.0.0.1:6379"),
    BETTER_AUTH_SECRET: z.string().min(16),
    OIDC_ISSUER_URL: z.string().url().default("http://localhost:3003"),
    FEDCM_ENABLED: z
      .preprocess((val) => val === "true" || val === true, z.boolean())
      .default(false),
    WEB_ORIGIN: z.string().url().default("http://localhost:3000"),
    SHOP_ORIGIN: z.string().url().default("http://localhost:3020"),
    LAX_ART_ORIGIN: z.string().url().default("http://localhost:3050"),
    SHOP_ADMIN_ORIGIN: z.string().url().default("http://localhost:3030"),
    LAX_ACCOUNT_ORIGIN: z.string().url().optional(),
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
    SSR_TRUSTED_ORIGINS: z.preprocess((val) => {
      if (val === undefined || val === "" || val == null) return undefined;
      if (typeof val !== "string") return undefined;
      const parts = val
        .split(",")
        .map((s) => s.trim())
        .filter((s) => s.length > 0);
      return parts.length > 0 ? parts : undefined;
    }, z.array(z.string().url()).optional()),
    AUTH_TRUSTED_PROXY_CIDRS: z
      .preprocess(
        (val) => {
          if (val === undefined || val === "" || val == null) return [];
          if (typeof val !== "string") return val;
          return val
            .split(",")
            .map((part) => part.trim())
            .filter(Boolean);
        },
        z.array(z.string().min(1)),
      )
      .default([]),
    AUTH_TRUSTED_CLOUDFLARE_PROXY_CIDRS: z
      .preprocess(
        (val) => {
          if (val === undefined || val === "" || val == null) return [];
          if (typeof val !== "string") return val;
          return val
            .split(",")
            .map((part) => part.trim())
            .filter(Boolean);
        },
        z.array(z.string().min(1)),
      )
      .default([]),
    /** Proxies we operate that append to the forwarded-for chain; 1 is the App Platform ingress. */
    AUTH_TRUSTED_PROXY_HOPS: z.preprocess((val) => {
      const n = typeof val === "string" && val.trim() !== "" ? Number(val) : val;
      return typeof n === "number" && Number.isInteger(n) && n >= 1 && n <= 10 ? n : 1;
    }, z.number().int().min(1)),
    AUTH_CLIENT_IP_DIAGNOSTICS: z
      .preprocess((value) => value === "true" || value === true, z.boolean())
      .default(false),
    JWT_AUDIENCE: z.preprocess(emptyToUndefined, z.string().min(1).optional()),
    AUTH_DEK_KEY: z.preprocess(emptyToUndefined, z.string().min(1).optional()),
    METRICS_TOKEN: z.preprocess(emptyToUndefined, z.string().min(16).optional()),
    IDENTITY_MACHINE_CLIENT_ID: z.preprocess(emptyToUndefined, z.string().min(1).optional()),
    IDENTITY_MACHINE_CLIENT_SECRET: z.preprocess(emptyToUndefined, z.string().min(32).optional()),
    /**
     * The worker's credential for the "Download my data" progress route (scope `subject_export`).
     * Distinct from the lifecycle credential above, so neither can do the other's work. Both or
     * neither; with neither, the progress route is not mounted.
     */
    SUBJECT_EXPORT_MACHINE_CLIENT_ID: z.preprocess(emptyToUndefined, z.string().min(1).optional()),
    SUBJECT_EXPORT_MACHINE_CLIENT_SECRET: z.preprocess(
      emptyToUndefined,
      z.string().min(32).optional(),
    ),
    /**
     * Bid admin's credential for the staff-assisted email change (scope `staff_email_change`).
     * Distinct from the other machine credentials, so a leak of one cannot move an account to a
     * new address. Both or neither; with neither, the route is not mounted.
     */
    STAFF_EMAIL_CHANGE_MACHINE_CLIENT_ID: z.preprocess(
      emptyToUndefined,
      z.string().min(1).optional(),
    ),
    STAFF_EMAIL_CHANGE_MACHINE_CLIENT_SECRET: z.preprocess(
      emptyToUndefined,
      z.string().min(32).optional(),
    ),
    /**
     * Bid admin's credential for the Data requests routes (scope `data_requests.staff`). Distinct
     * from the lifecycle and export credentials, so a leak of either cannot list requests. Both
     * or neither; with neither, the routes are not mounted.
     */
    DATA_REQUESTS_MACHINE_CLIENT_ID: z.preprocess(emptyToUndefined, z.string().min(1).optional()),
    DATA_REQUESTS_MACHINE_CLIENT_SECRET: z.preprocess(
      emptyToUndefined,
      z.string().min(32).optional(),
    ),
    /**
     * Days after a manual data request closes before its contact name and details are cleared.
     * The dates, scope, outcome and audit stay. 730 days (two years) is a working figure: lawyer to confirm.
     */
    DATA_REQUEST_CONTACT_RETENTION_DAYS: z.coerce.number().int().min(1).max(3650).default(730),
    /**
     * The private bucket holding personal data copies. Identity only signs reads, so these
     * credentials must be read-only; the worker writes and deletes with its own. All of bucket,
     * region and the key pair, or none; with none, requests still work and downloads answer 503.
     */
    SUBJECT_EXPORT_BUCKET: z.preprocess(emptyToUndefined, z.string().min(1).optional()),
    SUBJECT_EXPORT_REGION: z.preprocess(emptyToUndefined, z.string().min(1).optional()),
    SUBJECT_EXPORT_ENDPOINT: z.preprocess(emptyToUndefined, z.string().url().optional()),
    SUBJECT_EXPORT_READ_ACCESS_KEY_ID: z.preprocess(emptyToUndefined, z.string().min(1).optional()),
    SUBJECT_EXPORT_READ_SECRET_ACCESS_KEY: z.preprocess(
      emptyToUndefined,
      z.string().min(1).optional(),
    ),
    IDENTITY_MERGE_ENABLED: z
      .preprocess((value) => value === "true" || value === true, z.boolean())
      .default(false),
    /** First-party SSF streams and delivery worker are opt-in in every environment. */
    SSF_DELIVERY_ENABLED: z
      .preprocess((value) => value === "true" || value === true, z.boolean())
      .default(false),
    SSF_DELIVERY_TIMEOUT_MS: z.coerce.number().int().min(500).max(30_000).default(5_000),
    SSF_DELIVERY_MAX_ATTEMPTS: z.coerce.number().int().min(1).max(20).default(8),
    ALLOW_HTTP_COOKIES: z
      .preprocess((val) => val === "true" || val === true, z.boolean())
      .default(false),
    LOG_LEVEL: z.enum(["fatal", "error", "warn", "info", "debug", "trace"]).default("info"),
    SENTRY_RELEASE: z.preprocess(emptyToUndefined, z.string().min(1).optional()),
    SENTRY_DSN_AUTH: z.preprocess(emptyToUndefined, z.string().url().optional()),
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
    TURNSTILE_SITE_KEY: z.preprocess(emptyToUndefined, z.string().min(1).optional()),
    TOTP_ISSUER: z.preprocess(emptyToUndefined, z.string().min(1).optional()),
    HOSTED_AUTH_EMAIL_FIRST: z
      .preprocess((val) => {
        if (val === undefined || val === "") return true;
        return val === "true" || val === true;
      }, z.boolean())
      .default(true),
    DISABLE_NEW_USER_REGISTRATION: z
      .preprocess((v) => v === "true" || v === true, z.boolean())
      .default(false),
    ENABLE_PHONE_VERIFICATION: z
      .preprocess((val) => val === "true" || val === true, z.boolean())
      .default(false),
    TWILIO_ACCOUNT_SID: z.preprocess(emptyToUndefined, z.string().optional()),
    TWILIO_VERIFY_SERVICE_SID: z.preprocess(emptyToUndefined, z.string().optional()),
    TWILIO_API_KEY_SID: z.preprocess(emptyToUndefined, z.string().optional()),
    TWILIO_API_KEY_SECRET: z.preprocess(emptyToUndefined, z.string().optional()),
    TWILIO_AUTH_TOKEN: z.preprocess(emptyToUndefined, z.string().optional()),
  })
  .superRefine((e, ctx) => {
    if (e.NODE_ENV === "production") {
      const browserFacingUrls: Array<[field: string, url: string]> = [
        ["OIDC_ISSUER_URL", e.OIDC_ISSUER_URL],
        ["WEB_ORIGIN", e.WEB_ORIGIN],
        ["SHOP_ORIGIN", e.SHOP_ORIGIN],
        ["LAX_ART_ORIGIN", e.LAX_ART_ORIGIN],
        ["SHOP_ADMIN_ORIGIN", e.SHOP_ADMIN_ORIGIN],
        ...(e.WEB_ORIGINS ?? []).map((url): [field: string, url: string] => ["WEB_ORIGINS", url]),
        ...(e.SSR_TRUSTED_ORIGINS ?? []).map((url): [field: string, url: string] => [
          "SSR_TRUSTED_ORIGINS",
          url,
        ]),
      ];
      for (const [field, url] of browserFacingUrls) {
        if (new URL(url).protocol !== "https:") {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: `${field} must use HTTPS in NODE_ENV=production`,
            path: [field],
          });
        }
      }
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
      for (const u of [
        e.WEB_ORIGIN,
        e.SHOP_ORIGIN,
        e.SHOP_ADMIN_ORIGIN,
        e.LAX_ART_ORIGIN,
        e.OIDC_ISSUER_URL,
        e.API_INTERNAL_BASE_URL,
      ]) {
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
      if (!e.IDENTITY_MACHINE_CLIENT_ID || !e.IDENTITY_MACHINE_CLIENT_SECRET) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message:
            "IDENTITY_MACHINE_CLIENT_ID and IDENTITY_MACHINE_CLIENT_SECRET are required in production",
          path: ["IDENTITY_MACHINE_CLIENT_ID"],
        });
      }
    }
    if (
      Boolean(e.SUBJECT_EXPORT_MACHINE_CLIENT_ID) !==
      Boolean(e.SUBJECT_EXPORT_MACHINE_CLIENT_SECRET)
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message:
          "SUBJECT_EXPORT_MACHINE_CLIENT_ID and SUBJECT_EXPORT_MACHINE_CLIENT_SECRET must be set together",
        path: ["SUBJECT_EXPORT_MACHINE_CLIENT_ID"],
      });
    }
    if (
      e.SUBJECT_EXPORT_MACHINE_CLIENT_ID &&
      e.SUBJECT_EXPORT_MACHINE_CLIENT_ID === e.IDENTITY_MACHINE_CLIENT_ID
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "SUBJECT_EXPORT_MACHINE_CLIENT_ID must differ from IDENTITY_MACHINE_CLIENT_ID",
        path: ["SUBJECT_EXPORT_MACHINE_CLIENT_ID"],
      });
    }
    if (
      Boolean(e.DATA_REQUESTS_MACHINE_CLIENT_ID) !== Boolean(e.DATA_REQUESTS_MACHINE_CLIENT_SECRET)
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message:
          "DATA_REQUESTS_MACHINE_CLIENT_ID and DATA_REQUESTS_MACHINE_CLIENT_SECRET must be set together",
        path: ["DATA_REQUESTS_MACHINE_CLIENT_ID"],
      });
    }
    for (const other of [e.IDENTITY_MACHINE_CLIENT_ID, e.SUBJECT_EXPORT_MACHINE_CLIENT_ID]) {
      if (e.DATA_REQUESTS_MACHINE_CLIENT_ID && e.DATA_REQUESTS_MACHINE_CLIENT_ID === other) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message:
            "DATA_REQUESTS_MACHINE_CLIENT_ID must differ from IDENTITY_MACHINE_CLIENT_ID and SUBJECT_EXPORT_MACHINE_CLIENT_ID",
          path: ["DATA_REQUESTS_MACHINE_CLIENT_ID"],
        });
      }
    }
    if (
      Boolean(e.STAFF_EMAIL_CHANGE_MACHINE_CLIENT_ID) !==
      Boolean(e.STAFF_EMAIL_CHANGE_MACHINE_CLIENT_SECRET)
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message:
          "STAFF_EMAIL_CHANGE_MACHINE_CLIENT_ID and STAFF_EMAIL_CHANGE_MACHINE_CLIENT_SECRET must be set together",
        path: ["STAFF_EMAIL_CHANGE_MACHINE_CLIENT_ID"],
      });
    }
    if (
      e.STAFF_EMAIL_CHANGE_MACHINE_CLIENT_ID &&
      (e.STAFF_EMAIL_CHANGE_MACHINE_CLIENT_ID === e.IDENTITY_MACHINE_CLIENT_ID ||
        e.STAFF_EMAIL_CHANGE_MACHINE_CLIENT_ID === e.SUBJECT_EXPORT_MACHINE_CLIENT_ID ||
        e.STAFF_EMAIL_CHANGE_MACHINE_CLIENT_ID === e.DATA_REQUESTS_MACHINE_CLIENT_ID)
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message:
          "STAFF_EMAIL_CHANGE_MACHINE_CLIENT_ID must differ from the other machine client ids",
        path: ["STAFF_EMAIL_CHANGE_MACHINE_CLIENT_ID"],
      });
    }
    const bucketFields = [
      e.SUBJECT_EXPORT_BUCKET,
      e.SUBJECT_EXPORT_REGION,
      e.SUBJECT_EXPORT_READ_ACCESS_KEY_ID,
      e.SUBJECT_EXPORT_READ_SECRET_ACCESS_KEY,
    ];
    if (bucketFields.some(Boolean) && !bucketFields.every(Boolean)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message:
          "SUBJECT_EXPORT_BUCKET, SUBJECT_EXPORT_REGION, SUBJECT_EXPORT_READ_ACCESS_KEY_ID and SUBJECT_EXPORT_READ_SECRET_ACCESS_KEY must be set together",
        path: ["SUBJECT_EXPORT_BUCKET"],
      });
    }
    if (e.NODE_ENV === "production" && e.ENABLE_PHONE_VERIFICATION) {
      if (!e.TWILIO_ACCOUNT_SID?.trim()) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "TWILIO_ACCOUNT_SID is required when ENABLE_PHONE_VERIFICATION=true",
          path: ["TWILIO_ACCOUNT_SID"],
        });
      }
      if (!e.TWILIO_VERIFY_SERVICE_SID?.trim()) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "TWILIO_VERIFY_SERVICE_SID is required when ENABLE_PHONE_VERIFICATION=true",
          path: ["TWILIO_VERIFY_SERVICE_SID"],
        });
      }
      const hasApiKey =
        Boolean(e.TWILIO_API_KEY_SID?.trim()) && Boolean(e.TWILIO_API_KEY_SECRET?.trim());
      const hasAuthToken = Boolean(e.TWILIO_AUTH_TOKEN?.trim());
      if (!hasApiKey && !hasAuthToken) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message:
            "TWILIO_API_KEY_SID + TWILIO_API_KEY_SECRET (or TWILIO_AUTH_TOKEN) required when ENABLE_PHONE_VERIFICATION=true",
          path: ["TWILIO_API_KEY_SID"],
        });
      }
    }
  });

export type AuthAppEnv = z.infer<typeof envSchema>;

/** Known shop → shop-admin public hosts when Terraform has not set SHOP_ADMIN_ORIGIN yet. */
export function deriveShopAdminOriginFromShopOrigin(shopOrigin: string): string | undefined {
  try {
    const host = new URL(shopOrigin).hostname;
    if (host === "test-shop.lax.bid") return "https://test-shop-admin.lax.bid";
    if (host === "shop.lax.bid") return "https://shop-admin.lax.bid";
  } catch {
    return undefined;
  }
  return undefined;
}

export function deriveLaxArtOriginFromShopOrigin(shopOrigin: string): string | undefined {
  try {
    const host = new URL(shopOrigin).hostname;
    if (host === "test-shop.lax.bid") return "https://test-art.lax.bid";
    if (host === "shop.lax.bid" || host === "shop.lax.art") return "https://www.thelax.art";
  } catch {
    return undefined;
  }
  return undefined;
}

function withDerivedProductOrigins(input: NodeJS.ProcessEnv): NodeJS.ProcessEnv {
  let next = input;
  const shopOrigin = input.SHOP_ORIGIN?.trim();

  const rawAdmin = input.SHOP_ADMIN_ORIGIN?.trim();
  const needsAdminDerive =
    rawAdmin === undefined ||
    rawAdmin === "" ||
    rawAdmin === "http://localhost:3030" ||
    rawAdmin.startsWith("http://127.0.0.1");
  if (needsAdminDerive && shopOrigin) {
    const derived = deriveShopAdminOriginFromShopOrigin(shopOrigin);
    if (derived) next = { ...next, SHOP_ADMIN_ORIGIN: derived };
  }

  const rawArt = input.LAX_ART_ORIGIN?.trim();
  const needsArtDerive =
    rawArt === undefined ||
    rawArt === "" ||
    rawArt === "http://localhost:3050" ||
    rawArt.startsWith("http://127.0.0.1");
  if (needsArtDerive && shopOrigin) {
    const derivedArt = deriveLaxArtOriginFromShopOrigin(shopOrigin);
    if (derivedArt) next = { ...next, LAX_ART_ORIGIN: derivedArt };
  }

  return next;
}

function formatAuthEnvIssues(error: z.ZodError): string {
  return error.issues
    .map((issue) => {
      const path = issue.path.length > 0 ? issue.path.join(".") : "(root)";
      return `${path}: ${issue.message}`;
    })
    .join("; ");
}

export function parseAuthEnv(input: NodeJS.ProcessEnv): AuthAppEnv {
  const parsed = envSchema.safeParse(withDerivedProductOrigins(input));
  if (!parsed.success) {
    throw new Error(`Invalid auth app environment variables: ${formatAuthEnvIssues(parsed.error)}`);
  }
  return parsed.data;
}

export function loadAuthEnv(): AuthAppEnv {
  try {
    return parseAuthEnv(process.env);
  } catch (error) {
    console.error(error);
    throw error;
  }
}
