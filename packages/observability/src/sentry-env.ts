export type SentryAppKey = "web" | "api" | "auth" | "ws" | "worker";

const SENTRY_ORG_DEFAULT = "lax-bid";

/** Unified environment tag: SENTRY_ENVIRONMENT → APP_ENV → NODE_ENV → development. */
export function resolveSentryEnvironmentFromEnv(): string {
  const env =
    process.env.SENTRY_ENVIRONMENT ?? process.env.APP_ENV ?? process.env.NODE_ENV ?? "development";
  return env;
}

/** Terraform project slug: lax-{test|prod|dev}-{appKey}. */
export function resolveSentryProjectSlug(appKey: SentryAppKey): string {
  const env = resolveSentryEnvironmentFromEnv();
  const suffix = env === "test" ? "test" : env === "production" || env === "prod" ? "prod" : "dev";
  return `lax-${suffix}-${appKey}`;
}

export function resolveSentryOrg(): string {
  return process.env.SENTRY_ORG ?? SENTRY_ORG_DEFAULT;
}
