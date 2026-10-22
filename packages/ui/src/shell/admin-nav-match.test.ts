import { describe, expect, it } from "vitest";
import { resolveActiveNavHref } from "./admin-nav-match.js";

const HREFS = ["/overview", "/orders", "/orders/archive", "/clients"];

describe("resolveActiveNavHref", () => {
  it("matches an exact path", () => {
    expect(resolveActiveNavHref("/orders", HREFS)).toBe("/orders");
  });

  it("highlights the list for a detail page", () => {
    expect(resolveActiveNavHref("/clients/abc-123", HREFS)).toBe("/clients");
  });

  it("prefers the longest matching prefix", () => {
    expect(resolveActiveNavHref("/orders/archive/2026", HREFS)).toBe("/orders/archive");
  });

  it("does not match a sibling that merely shares a prefix", () => {
    expect(resolveActiveNavHref("/orders-old", HREFS)).toBeNull();
  });

  it("ignores query strings and trailing slashes", () => {
    expect(resolveActiveNavHref("/orders/?cursor=abc", HREFS)).toBe("/orders");
  });

  it("returns null when nothing owns the path", () => {
    expect(resolveActiveNavHref("/settings", HREFS)).toBeNull();
  });
});
