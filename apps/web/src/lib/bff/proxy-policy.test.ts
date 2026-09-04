import { describe, expect, it } from "vitest";
import {
  isApprovedProxyPath,
  sanitizedProxyRequestHeaders,
  sanitizedProxyResponseHeaders,
  scopesForProxyMethod,
} from "./proxy-policy";

describe("Bid BFF proxy policy", () => {
  it("requests least-privilege scopes by HTTP method", () => {
    expect(scopesForProxyMethod("GET")).toBe("bid.read");
    expect(scopesForProxyMethod("HEAD")).toBe("bid.read");
    expect(scopesForProxyMethod("POST")).toBe("bid.write");
    expect(scopesForProxyMethod("DELETE")).toBe("bid.write");
  });

  it("allows only named API roots and rejects traversal/open-proxy shapes", () => {
    expect(isApprovedProxyPath(["users", "me"])).toBe(true);
    expect(isApprovedProxyPath(["telephone-bookings", "booking-1"])).toBe(true);
    expect(isApprovedProxyPath(["https:", "attacker.example"])).toBe(false);
    expect(isApprovedProxyPath(["internal", "jobs"])).toBe(false);
    expect(isApprovedProxyPath(["users", "..", "admin"])).toBe(false);
    expect(isApprovedProxyPath(["webhooks", "stripe"])).toBe(false);
  });

  it("strips browser cookie and authorization while installing the BFF bearer", () => {
    const headers = sanitizedProxyRequestHeaders(
      new Headers({
        authorization: "Bearer attacker",
        cookie: "identity=secret",
        connection: "keep-alive",
        "content-type": "application/json",
        "x-legal-entity-id": "entity-1",
      }),
      "resource-token",
    );
    expect(headers.get("authorization")).toBe("Bearer resource-token");
    expect(headers.has("cookie")).toBe(false);
    expect(headers.has("connection")).toBe(false);
    expect(headers.get("content-type")).toBe("application/json");
  });

  it("preserves safe response metadata but strips cookies and hop-by-hop headers", () => {
    const headers = sanitizedProxyResponseHeaders(
      new Headers({
        "set-cookie": "identity=secret",
        connection: "close",
        "content-type": "application/json",
        etag: '"abc"',
      }),
    );
    expect(headers.has("set-cookie")).toBe(false);
    expect(headers.has("connection")).toBe(false);
    expect(headers.get("etag")).toBe('"abc"');
  });
});
