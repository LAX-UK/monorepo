import {
  isSafeNextPath,
  resolvePostAuthDestination,
  roleDefaultDestination,
} from "@/lib/auth/post-auth-destination";
import { describe, expect, it } from "vitest";

const clientUser = {
  role: "client" as const,
  email: "a@b.com",
  emailVerified: true,
  suspended: false as const,
};

describe("isSafeNextPath", () => {
  it("accepts safe internal paths", () => {
    expect(isSafeNextPath("/dashboard")).toBe(true);
    expect(isSafeNextPath("/dashboard/portfolio")).toBe(true);
    expect(isSafeNextPath("/sales/foo?bar=1")).toBe(true);
  });

  it("rejects open redirects and APIs", () => {
    expect(isSafeNextPath("")).toBe(false);
    expect(isSafeNextPath("//evil.com")).toBe(false);
    expect(isSafeNextPath("https://evil.com")).toBe(false);
    expect(isSafeNextPath("/\\evil.com")).toBe(false);
    expect(isSafeNextPath("/api/users")).toBe(false);
    expect(isSafeNextPath("/admin/api/secret")).toBe(false);
    expect(isSafeNextPath("relative")).toBe(false);
    expect(isSafeNextPath(null)).toBe(false);
  });
});

describe("roleDefaultDestination", () => {
  it("maps roles", () => {
    expect(roleDefaultDestination("administrator")).toBe("/admin");
    expect(roleDefaultDestination("accountant")).toBe("/admin/payments");
    expect(roleDefaultDestination("client")).toBe("/dashboard");
  });
});

describe("resolvePostAuthDestination", () => {
  it("sends suspended users to account-suspended", () => {
    expect(
      resolvePostAuthDestination({
        user: { ...clientUser, suspended: true },
        context: "redirect-if-authed",
      }),
    ).toBe("/account-suspended");
  });

  it("sends unverified users to verify-pending when required (sign-up / redirect-if-authed)", () => {
    expect(
      resolvePostAuthDestination({
        user: { ...clientUser, emailVerified: false },
        context: "sign-up",
        requireEmailVerification: true,
      }),
    ).toBe("/register/verify-pending?email=a%40b.com");
    expect(
      resolvePostAuthDestination({
        user: { ...clientUser, emailVerified: false },
        context: "redirect-if-authed",
        requireEmailVerification: true,
      }),
    ).toBe("/register/verify-pending?email=a%40b.com");
  });

  it("uses safe next when present", () => {
    expect(
      resolvePostAuthDestination({
        user: clientUser,
        requestedNext: "/dashboard/bids",
        context: "sign-in",
      }),
    ).toBe("/dashboard/bids");
  });

  it("falls back to role default when next is unsafe", () => {
    expect(
      resolvePostAuthDestination({
        user: clientUser,
        requestedNext: "//evil.com",
        context: "sign-in",
      }),
    ).toBe("/dashboard");
    expect(
      resolvePostAuthDestination({
        user: { ...clientUser, role: "administrator" },
        requestedNext: "//evil",
        context: "sign-in",
      }),
    ).toBe("/admin");
  });

  it("appends welcome=back", () => {
    expect(
      resolvePostAuthDestination({
        user: clientUser,
        requestedNext: "/dashboard/portfolio",
        context: "sign-in",
        withWelcomeBack: true,
      }),
    ).toBe("/dashboard/portfolio?welcome=back");
    expect(
      resolvePostAuthDestination({
        user: clientUser,
        context: "sign-in",
        withWelcomeBack: true,
      }),
    ).toBe("/dashboard?welcome=back");
  });
});
