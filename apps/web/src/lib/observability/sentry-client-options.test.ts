import { readdirSync } from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import {
  BROWSER_TRACED_SEGMENTS,
  BROWSER_TRACING_INTEGRATION,
  type TracingClient,
  type WebClientSentryOptions,
  createWebClientSentryOptions,
  enableBrowserTracingOnNavigation,
  isBrowserTracedPath,
} from "./sentry-client-options";

const DSN = "https://public@sentry.invalid/1";
const appDir = path.resolve(__dirname, "../../app");

function routeSegments(group: string): string[] {
  return readdirSync(path.join(appDir, group), { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name);
}

type BrowserSdk = Pick<
  typeof import("@sentry/nextjs"),
  | "getDefaultIntegrations"
  | "browserTracingIntegration"
  | "init"
  | "getClient"
  | "captureRouterTransitionStart"
  | "getActiveSpan"
  | "spanToJSON"
>;

/** The browser build of the SDK, the one `instrumentation-client.ts` runs (tests resolve the Node one). */
let Sentry: BrowserSdk;

/**
 * The defaults `Sentry.init` hands to `integrations` in the browser: the exported browser defaults
 * plus the Next.js tracing integration, which the SDK's client `init` adds to them.
 */
function sdkDefaultIntegrations() {
  return [...Sentry.getDefaultIntegrations({}), Sentry.browserTracingIntegration()];
}

/** The integrations `Sentry.init` would install with these options. */
function installed(options: WebClientSentryOptions) {
  const defaults = sdkDefaultIntegrations();
  return (options.integrations ? options.integrations(defaults) : defaults).map((i) => i.name);
}

describe("browser Sentry options", () => {
  beforeAll(() => {
    const require = createRequire(import.meta.url);
    const sdkDir = path.dirname(require.resolve("@sentry/nextjs/package.json"));
    Sentry = require(path.join(sdkDir, "build/cjs/index.client.js")) as BrowserSdk;
  });

  it("uses the SDK's name for the tracing integration", () => {
    expect(Sentry.browserTracingIntegration().name).toBe(BROWSER_TRACING_INTEGRATION);
  });

  describe.each(["/", "/sales/autumn-sale/42", "/lot/a-painting/7", "/about", "/terms"])(
    "public page %s",
    (pathname) => {
      const options = createWebClientSentryOptions(DSN, pathname, () => pathname);

      it("reports errors", () => {
        expect(options.dsn).toBe(DSN);
        expect(typeof options.beforeSend).toBe("function");
        const names = installed(options);
        expect(names).toEqual(
          expect.arrayContaining(["GlobalHandlers", "BrowserApiErrors", "LinkedErrors", "Dedupe"]),
        );
      });

      it("has no tracing integration and no trace sampling", () => {
        const names = installed(options);
        expect(names).not.toContain(BROWSER_TRACING_INTEGRATION);
        expect(options).not.toHaveProperty("tracesSampleRate");
        expect(options).not.toHaveProperty("tracesSampler");
        expect(options).not.toHaveProperty("profilesSampleRate");
      });
    },
  );

  describe.each(["/home", "/purchases/checkout/1", "/settings", "/login", "/admin/sales"])(
    "account or staff page %s",
    (pathname) => {
      const options = createWebClientSentryOptions(DSN, pathname, () => pathname);

      it("keeps the SDK's default integrations, tracing included, and reports errors", () => {
        expect(options).not.toHaveProperty("integrations");
        expect(installed(options)).toEqual(
          expect.arrayContaining([BROWSER_TRACING_INTEGRATION, "GlobalHandlers", "LinkedErrors"]),
        );
        expect(typeof options.beforeSend).toBe("function");
        expect(options.tracesSampleRate).toBeGreaterThan(0);
      });

      it("samples its own transactions", () => {
        expect(
          options.tracesSampler?.({ name: pathname, transactionContext: { name: pathname } }),
        ).toBe(options.tracesSampleRate);
      });
    },
  );

  it("drops the spans of a public page reached by client navigation from an account page", () => {
    let current = "/home";
    const options = createWebClientSentryOptions(DSN, "/home", () => current);
    current = "/sales/autumn-sale/42";
    expect(options.tracesSampler?.({ name: current, transactionContext: { name: current } })).toBe(
      0,
    );
  });

  it("samples a navigation span by the page it opens, not the page it leaves", () => {
    let current = "/sales/autumn-sale/42";
    const options = createWebClientSentryOptions(DSN, "/home", () => current);
    const navigation = (name: string) => ({
      name,
      attributes: { "sentry.op": "navigation" },
      transactionContext: { name },
    });
    // Next starts the span before the address changes.
    expect(options.tracesSampler?.(navigation("/bids"))).toBe(options.tracesSampleRate);
    current = "/home";
    expect(options.tracesSampler?.(navigation("/lot/a-painting/7"))).toBe(0);
  });

  it("traces every account, task and staff route folder and no marketing one", () => {
    const traced = [
      ...routeSegments("(client)"),
      ...routeSegments("(task)"),
      "admin",
      "account-suspended",
    ];
    expect([...BROWSER_TRACED_SEGMENTS].sort()).toEqual([...new Set(traced)].sort());
    for (const segment of routeSegments("(marketing)").filter((s) => !s.startsWith("("))) {
      expect(isBrowserTracedPath(`/${segment}`)).toBe(false);
    }
    expect(isBrowserTracedPath("/")).toBe(false);
  });
});

/** A stand-in for the browser client: its live options and the integrations added to it. */
function fakeClient(dsn = DSN) {
  const options: Record<string, unknown> = { dsn };
  const added: { name: string }[] = [];
  const client: TracingClient = {
    getOptions: () => options,
    getIntegrationByName: (name) => added.find((integration) => integration.name === name),
    addIntegration: (integration) => {
      added.push(integration);
    },
  };
  return { client, options, added };
}

const BASE = "https://www.example.test/sales";
const tracing = () => ({ name: BROWSER_TRACING_INTEGRATION });

describe("browser tracing turned on by navigation (session started on a public page)", () => {
  it.each(["/", "/sales/autumn-sale/42", "/lot/a-painting/7", "/search?q=x", "/about#team"])(
    "stays off when navigating to the public page %s",
    (href) => {
      const { client, options, added } = fakeClient();
      expect(enableBrowserTracingOnNavigation(client, href, tracing, () => "/", BASE)).toBe(false);
      expect(added).toEqual([]);
      expect(options).not.toHaveProperty("tracesSampleRate");
      expect(options).not.toHaveProperty("tracesSampler");
    },
  );

  it.each([
    "/bids",
    "/home",
    "/purchases/checkout/1?x=1",
    "/login",
    "/admin/sales",
    `${BASE}/../settings`,
  ])("turns on, with the same sampling a traced first page gets, when navigating to %s", (href) => {
    const { client, options, added } = fakeClient();
    expect(enableBrowserTracingOnNavigation(client, href, tracing, () => "/", BASE)).toBe(true);
    expect(added.map((integration) => integration.name)).toEqual([BROWSER_TRACING_INTEGRATION]);
    const traced = createWebClientSentryOptions(DSN, "/home", () => "/home");
    expect(options.tracesSampleRate).toBe(traced.tracesSampleRate);
    expect(options.profilesSampleRate).toBe(traced.profilesSampleRate);
    const sampler = options.tracesSampler as NonNullable<typeof traced.tracesSampler>;
    const navigation = (name: string) => ({
      name,
      attributes: { "sentry.op": "navigation" },
      transactionContext: { name },
    });
    expect(sampler(navigation("/bids"))).toBe(traced.tracesSampleRate);
    expect(sampler(navigation("/sales/autumn-sale/42"))).toBe(0);
  });

  it("adds the integration once", () => {
    const { client, added } = fakeClient();
    enableBrowserTracingOnNavigation(client, "/bids", tracing, () => "/", BASE);
    expect(enableBrowserTracingOnNavigation(client, "/home", tracing, () => "/bids", BASE)).toBe(
      false,
    );
    expect(added).toHaveLength(1);
  });

  it("does nothing without a client or a DSN", () => {
    expect(enableBrowserTracingOnNavigation(undefined, "/bids", tracing, () => "/", BASE)).toBe(
      false,
    );
    const { client, added } = fakeClient("");
    expect(enableBrowserTracingOnNavigation(client, "/bids", tracing, () => "/", BASE)).toBe(false);
    expect(added).toEqual([]);
  });

  describe("with the real browser SDK", () => {
    afterEach(() => {
      vi.restoreAllMocks();
    });

    it("traces the navigation into the account area and not the public page before it", () => {
      // Every sample-rate draw passes, so the result shows the sampler's own decision.
      vi.spyOn(Math, "random").mockReturnValue(0);
      window.history.replaceState(null, "", "/sales");
      Sentry.init({
        ...createWebClientSentryOptions(DSN, "/sales"),
        transport: () => ({ send: async () => ({}), flush: async () => true }),
      } as Parameters<BrowserSdk["init"]>[0]);
      const client = Sentry.getClient() as unknown as TracingClient;
      expect(client.getIntegrationByName(BROWSER_TRACING_INTEGRATION)).toBeUndefined();

      // A public navigation: still no tracing.
      enableBrowserTracingOnNavigation(client, "/lot/a-painting/7", () =>
        Sentry.browserTracingIntegration({ instrumentPageLoad: false }),
      );
      Sentry.captureRouterTransitionStart("/lot/a-painting/7", "push");
      expect(client.getIntegrationByName(BROWSER_TRACING_INTEGRATION)).toBeUndefined();
      expect(Sentry.getActiveSpan()).toBeUndefined();

      // Into the account area: tracing turns on and this navigation gets a sampled span.
      expect(
        enableBrowserTracingOnNavigation(client, "/bids", () =>
          Sentry.browserTracingIntegration({ instrumentPageLoad: false }),
        ),
      ).toBe(true);
      Sentry.captureRouterTransitionStart("/bids", "push");
      const span = Sentry.getActiveSpan();
      expect(span).toBeDefined();
      const json = Sentry.spanToJSON(span as NonNullable<typeof span>);
      expect(json.op).toBe("navigation");
      expect(json.description).toBe("/bids");
      expect((span as NonNullable<typeof span>).isRecording()).toBe(true);
    });
  });
});
