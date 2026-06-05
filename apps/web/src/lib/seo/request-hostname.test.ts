import { describe, expect, it } from "vitest";
import { resolveRequestHostname } from "./request-hostname";

function bag(entries: Record<string, string>) {
  return { get: (name: string) => entries[name.toLowerCase()] ?? null };
}

describe("resolveRequestHostname", () => {
  it("prefers x-forwarded-host (public domain behind a proxy)", () => {
    const headers = bag({ "x-forwarded-host": "lax.bid", host: "web-internal.ondigitalocean.app" });
    expect(resolveRequestHostname(headers)).toBe("lax.bid");
  });

  it("uses the first forwarded host when comma-separated", () => {
    const headers = bag({ "x-forwarded-host": "lax.bid, internal" });
    expect(resolveRequestHostname(headers)).toBe("lax.bid");
  });

  it("falls back to the host header", () => {
    expect(resolveRequestHostname(bag({ host: "test.lax.bid" }))).toBe("test.lax.bid");
  });

  it("falls back to the provided fallback when no headers present", () => {
    expect(resolveRequestHostname(bag({}), "localhost")).toBe("localhost");
  });
});
