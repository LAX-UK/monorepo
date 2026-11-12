import { ACTING_LEGAL_ENTITY_COOKIE_NAME, encodeActingContextCookie } from "@auction/types";
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
    expect(isApprovedProxyPath(["sale-alerts", "unsubscribe"])).toBe(true);
    expect(isApprovedProxyPath(["alerts", "me", "topics", "bid.new_sales"])).toBe(true);
    expect(isApprovedProxyPath(["time"])).toBe(true);
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

  it("passes the enquiry draft token on, so a visitor's photos can be uploaded", () => {
    const headers = sanitizedProxyRequestHeaders(
      new Headers({ "x-enquiry-draft": "body.signature" }),
    );
    expect(headers.get("x-enquiry-draft")).toBe("body.signature");
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

  it("forwards only the view-as-client cookie, never the rest of the Cookie header", () => {
    const view = encodeActingContextCookie({
      v: 1,
      e: "6f1c2d3e-4a5b-4c6d-8e7f-0a1b2c3d4e5f",
      i: { sid: "0b9a8c7d-6e5f-4a3b-9c2d-1e0f9a8b7c6d" },
    });
    const headers = sanitizedProxyRequestHeaders(
      new Headers({
        cookie: `identity=secret; ${ACTING_LEGAL_ENTITY_COOKIE_NAME}=${view}; lax_bid_session=s`,
      }),
      "resource-token",
    );
    expect(headers.get("cookie")).toBe(`${ACTING_LEGAL_ENTITY_COOKIE_NAME}=${view}`);
  });
});
