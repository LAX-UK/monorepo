import { readdirSync } from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";
import { beforeAll, describe, expect, it } from "vitest";
import {
  BROWSER_TRACED_SEGMENTS,
  BROWSER_TRACING_INTEGRATION,
  type WebClientSentryOptions,
  createWebClientSentryOptions,
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
  "getDefaultIntegrations" | "browserTracingIntegration"
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
