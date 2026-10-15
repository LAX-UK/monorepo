import type { ErrorEvent } from "@sentry/core";
import { describe, expect, it } from "vitest";
import { createNextSentryOptions } from "./next-sentry-options.js";

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
