import { describe, expect, it } from "vitest";
import {
  canClientIntrospectAudience,
  isTokenOwnedByClient,
} from "./oauth-token-management.service.js";

describe("OAuth token requester policy", () => {
  it("prevents cross-client opaque token disclosure or revocation", () => {
    expect(isTokenOwnedByClient("lax-shop-web", "lax-shop-web")).toBe(true);
    expect(isTokenOwnedByClient("lax-shop-web", "lax-bid-web")).toBe(false);
  });

  it("only introspects token-exchange JWT audiences allowed to the requester", () => {
    expect(canClientIntrospectAudience("lax-shop-web", "lax-shop-api")).toBe(true);
    expect(canClientIntrospectAudience("lax-shop-web", "lax-bid-api")).toBe(false);
    expect(canClientIntrospectAudience("lax-bid-web", "lax-shop-api")).toBe(false);
  });
});
