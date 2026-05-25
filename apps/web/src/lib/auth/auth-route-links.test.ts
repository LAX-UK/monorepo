import { buildAuthHref, parseAuthEmailParam } from "@/lib/auth/auth-route-links";
import { describe, expect, it } from "vitest";

describe("buildAuthHref", () => {
  it("returns bare path when no options", () => {
    expect(buildAuthHref("/login")).toBe("/login");
  });

  it("appends safe next path", () => {
    expect(buildAuthHref("/register", { next: "/dashboard/bids" })).toBe(
      "/register?next=%2Fdashboard%2Fbids",
    );
  });

  it("rejects unsafe next paths", () => {
    expect(buildAuthHref("/login", { next: "//evil.com" })).toBe("/login");
    expect(buildAuthHref("/login", { next: "https://evil.com" })).toBe("/login");
  });

  it("appends valid email for forgot-password prefill", () => {
    expect(buildAuthHref("/forgot-password", { email: "user@example.com" })).toBe(
      "/forgot-password?email=user%40example.com",
    );
  });

  it("combines next and email", () => {
    expect(
      buildAuthHref("/forgot-password", {
        next: "/lot/test",
        email: "user@example.com",
      }),
    ).toBe("/forgot-password?next=%2Flot%2Ftest&email=user%40example.com");
  });

  it("ignores invalid email", () => {
    expect(buildAuthHref("/forgot-password", { email: "not-an-email" })).toBe("/forgot-password");
  });
});

describe("parseAuthEmailParam", () => {
  it("returns validated email or undefined", () => {
    expect(parseAuthEmailParam("user@example.com")).toBe("user@example.com");
    expect(parseAuthEmailParam("bad")).toBeUndefined();
    expect(parseAuthEmailParam(null)).toBeUndefined();
  });
});
