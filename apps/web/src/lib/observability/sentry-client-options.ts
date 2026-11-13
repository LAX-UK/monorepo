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

type SamplingContext = Parameters<NextSentryOptions["tracesSampler"]>[0];

/**
 * The path a span is about. A navigation span starts before the address changes, so its own name
 * (the path being opened) decides, not `window.location`; any other span uses the current page.
 */
function sampledPathname(ctx: SamplingContext, currentPathname: () => string): string {
  const op = ctx.attributes?.["sentry.op"];
  if ((op === "navigation" || op === "pageload") && ctx.name?.startsWith("/")) return ctx.name;
  return currentPathname();
}

/** The sample rates and sampler of a traced page: the shared ones, zero for public pages. */
function tracingSampling(dsn: string, currentPathname: () => string) {
  const { tracesSampleRate, profilesSampleRate, tracesSampler } = createNextSentryOptions(dsn);
  return {
    tracesSampleRate,
    profilesSampleRate,
    tracesSampler: (ctx: SamplingContext): number =>
      isBrowserTracedPath(sampledPathname(ctx, currentPathname)) ? tracesSampler(ctx) : 0,
  };
}

/**
 * Browser `Sentry.init` options. Error reporting (global handlers, linked errors, the scrubbing
 * `beforeSend`) is the same on every page. Performance tracing starts with the first account or
 * staff page of the session: a session that loads one keeps the tracing integration and the sample
 * rates from the start; a session that loads a public page gets neither, so it sends no
 * transactions, until it client-navigates into the account or staff area
 * (`enableBrowserTracingOnNavigation`). Once on, the sampler drops spans of public pages.
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

  return { ...errorReporting, ...tracingSampling(dsn, currentPathname) };
}

/** The part of the Sentry browser client that turning tracing on mid-session needs. */
export type TracingClient = {
  /** The live options object; the sampling fields are written onto it. */
  getOptions(): { dsn?: string | undefined };
  getIntegrationByName(name: string): unknown;
  addIntegration(integration: NamedIntegration): void;
};

/**
 * Called at the start of every client navigation (`onRouterTransitionStart`, before the navigation
 * span is started). When a session that began on a public page navigates into the account or staff
 * area, this turns tracing on: the client gets the same sample rates and sampler a traced first page
 * gets, and the tracing integration is added (`createIntegration`, without its page-load span: the
 * page already loaded). Public pages stay untraced. Returns whether it turned tracing on.
 */
export function enableBrowserTracingOnNavigation(
  client: TracingClient | undefined,
  href: string,
  createIntegration: () => NamedIntegration,
  currentPathname: () => string = () => window.location.pathname,
  base: string = window.location.href,
): boolean {
  if (!client || client.getIntegrationByName(BROWSER_TRACING_INTEGRATION)) return false;
  const dsn = client.getOptions().dsn;
  if (!dsn || !isBrowserTracedPath(new URL(href, base).pathname)) return false;
  Object.assign(client.getOptions(), tracingSampling(dsn, currentPathname));
  client.addIntegration(createIntegration());
  return true;
}
