import { isSafeNextPath, resolvePostAuthDestination } from "@/lib/auth/post-auth-destination";
import { staffRoleDefaultDestination } from "@auction/types";
import { describe, expect, it } from "vitest";

const clientUser = {
  role: "client" as const,
  staffRole: null,
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

describe("staffRoleDefaultDestination", () => {
  it("maps staff specializations", () => {
    expect(staffRoleDefaultDestination("staff", "super_admin")).toBe("/admin");
    expect(staffRoleDefaultDestination("staff", "finance_ops")).toBe("/admin/payments");
    expect(staffRoleDefaultDestination("client", null)).toBe("/dashboard");
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
        user: { ...clientUser, role: "staff", staffRole: "super_admin" },
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
