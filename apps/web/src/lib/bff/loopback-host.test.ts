import { describe, expect, it } from "vitest";
import { isLoopbackHostHeader, isLoopbackHostname, normalizeLoopbackOrigin } from "./loopback-host";

describe("loopback host helpers", () => {
  it("recognizes loopback hostnames and headers", () => {
    expect(isLoopbackHostname("0.0.0.0")).toBe(true);
    expect(isLoopbackHostHeader("0.0.0.0:3000")).toBe(true);
    expect(isLoopbackHostname("lax.bid")).toBe(false);
  });

  it("normalizes loopback origins to the configured canonical host", () => {
    expect(normalizeLoopbackOrigin("http://0.0.0.0:3000", "http://localhost:3000")).toBe(
      "http://localhost:3000",
    );
    expect(normalizeLoopbackOrigin("https://lax.bid", "http://localhost:3000")).toBe(
      "https://lax.bid",
    );
  });
});
