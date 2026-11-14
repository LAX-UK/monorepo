import type { ErrorEvent } from "@sentry/core";
import { describe, expect, it } from "vitest";
import {
  BROWSER_TRACING_INTEGRATION,
  createNextBrowserErrorOptions,
  createNextSentryOptions,
} from "./next-sentry-options.js";

describe("createNextSentryOptions", () => {
  const options = createNextSentryOptions("https://key@o0.ingest.sentry.io/1");

  it("keeps PII off and uses the storefront sample rates", () => {
    expect(options.sendDefaultPii).toBe(false);
    expect(options.dsn).toBe("https://key@o0.ingest.sentry.io/1");
  });

  it("drops web-vitals noise and keeps real errors", () => {
    const noise = { type: undefined, message: "web-vitals.lcp" } as ErrorEvent;
    const real = {
      type: undefined,
      exception: { values: [{ type: "TypeError", value: "boom" }] },
    } as ErrorEvent;
    expect(options.beforeSend(noise)).toBeNull();
    expect(options.beforeSend(real)).not.toBeNull();
  });
});

describe("createNextBrowserErrorOptions", () => {
  const options = createNextBrowserErrorOptions("https://key@o0.ingest.sentry.io/1");

  it("reports errors with PII off and sends no transactions", () => {
    expect(options.sendDefaultPii).toBe(false);
    expect(options.dsn).toBe("https://key@o0.ingest.sentry.io/1");
    expect(options).not.toHaveProperty("tracesSampleRate");
    expect(options).not.toHaveProperty("tracesSampler");
    expect(options).not.toHaveProperty("beforeSendTransaction");
  });

  it("removes only the browser tracing integration", () => {
    const defaults = [{ name: BROWSER_TRACING_INTEGRATION }, { name: "GlobalHandlers" }];
    expect(options.integrations(defaults)).toEqual([{ name: "GlobalHandlers" }]);
  });
});
