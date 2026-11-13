import { createNextSentryOptions } from "@auction/observability/next-sentry-options";

/** Name of the browser performance tracing integration in the Sentry SDK. */
export const BROWSER_TRACING_INTEGRATION = "BrowserTracing";

/**
 * First path segments of the pages that keep browser performance tracing: the signed-in account
 * area (`(client)`), the sign-in and onboarding tasks (`(task)`) and the staff area (`admin`).
 * Every other page is public (marketing) and reports errors only. `sentry-client-options.test.ts`
 * checks this list against the route folders.
 */
export const BROWSER_TRACED_SEGMENTS: ReadonlySet<string> = new Set([
  // (client)
  "bids",
  "collection",
  "compliance",
  "home",
  "legal-entities",
  "no-access",
  "notifications",
  "organisation",
  "organisations",
  "private-sales",
  "purchases",
  "restore-account",
  "selling",
  "settings",
  "switch-account",
  "team",
  "verify-identity",
  "watching",
  // (task)
  "auth",
  "forgot-password",
  "invitations",
  "login",
  "onboarding",
  "register",
  "reset-password",
  "verify-email",
  // signed-in, outside the groups
  "account-suspended",
  // staff
  "admin",
]);

/** True when the page at `pathname` keeps browser performance tracing (account and staff areas). */
export function isBrowserTracedPath(pathname: string): boolean {
  const firstSegment = pathname.split("/")[1] ?? "";
  return BROWSER_TRACED_SEGMENTS.has(firstSegment);
}

type NamedIntegration = { name: string };
type NextSentryOptions = ReturnType<typeof createNextSentryOptions>;

/** Browser init options: error reporting always, tracing fields only on traced pages. */
export type WebClientSentryOptions = Omit<
  NextSentryOptions,
  "tracesSampleRate" | "profilesSampleRate" | "tracesSampler"
> & {
  integrations?: <T extends NamedIntegration>(defaults: T[]) => T[];
  tracesSampleRate?: number;
  profilesSampleRate?: number;
  tracesSampler?: NextSentryOptions["tracesSampler"];
};

/**
 * Browser `Sentry.init` options. Error reporting (global handlers, linked errors, the scrubbing
 * `beforeSend`) is the same on every page. Performance tracing is decided by the page the browser
 * loaded: an account or staff page keeps the tracing integration and the sample rates, a public
 * page gets neither, so it sends no transactions. After a client navigation from an account page
 * to a public one, the sampler drops the public page's spans.
 */
export function createWebClientSentryOptions(
  dsn: string,
  initialPathname: string,
  currentPathname: () => string = () => window.location.pathname,
): WebClientSentryOptions {
  const { tracesSampleRate, profilesSampleRate, tracesSampler, ...errorReporting } =
    createNextSentryOptions(dsn);

  if (!isBrowserTracedPath(initialPathname)) {
    return {
      ...errorReporting,
      integrations: <T extends NamedIntegration>(defaults: T[]): T[] =>
        defaults.filter((integration) => integration.name !== BROWSER_TRACING_INTEGRATION),
    };
  }

  return {
    ...errorReporting,
    tracesSampleRate,
    profilesSampleRate,
    tracesSampler: (ctx: Parameters<typeof tracesSampler>[0]): number =>
      isBrowserTracedPath(currentPathname()) ? tracesSampler(ctx) : 0,
  };
}
