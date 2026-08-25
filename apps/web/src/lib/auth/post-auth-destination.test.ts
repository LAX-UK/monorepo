import { isSafeNextPath, resolvePostAuthDestination } from "@/lib/auth/post-auth-destination";
import { staffRoleDefaultDestination } from "@auction/types";
import { describe, expect, it } from "vitest";

const clientUser = {
  role: "client" as const,
  staffRole: null,
  email: "a@b.com",
  emailVerified: true,
  kycStatus: "approved" as const,
  signupPersona: "individual" as const,
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
    expect(isSafeNextPath("/%2F%2Fevil.com")).toBe(false);
    expect(isSafeNextPath("/%5Cevil")).toBe(false);
  });

  it("rejects auth-internal paths", () => {
    expect(isSafeNextPath("/login")).toBe(false);
    expect(isSafeNextPath("/register")).toBe(false);
    expect(isSafeNextPath("/auth/social-callback")).toBe(false);
    expect(isSafeNextPath("/account-suspended")).toBe(false);
  });
});

describe("staffRoleDefaultDestination", () => {
  it("maps staff specializations", () => {
    expect(staffRoleDefaultDestination("staff", "super_admin")).toBe("/admin");
    expect(staffRoleDefaultDestination("staff", "finance_ops")).toBe("/admin/finance");
    expect(staffRoleDefaultDestination("staff", "content_marketing")).toBe("/admin/artists");
    expect(staffRoleDefaultDestination("client", null)).toBe("/dashboard");
  });

  it("never sends staff to /dashboard", () => {
    expect(staffRoleDefaultDestination("staff", null)).toBe("/admin");
    expect(staffRoleDefaultDestination("staff", "content_marketing")).not.toBe("/dashboard");
  });
});

describe("resolvePostAuthDestination", () => {
  it("sends unapproved clients to their requested destination on login", () => {
    expect(
      resolvePostAuthDestination({
        user: {
          ...clientUser,
          kycStatus: "unverified",
          categoryInterestsOnboardingCompletedAt: new Date(),
        },
        requestedNext: "/dashboard/bids",
        context: "sign-in",
        fullBuyerOnboardingEnabled: true,
        withWelcomeBack: true,
      }),
    ).toBe("/dashboard/bids?welcome=back");
  });

  it("starts the full interests flow on login when onboarding is still incomplete", () => {
    expect(
      resolvePostAuthDestination({
        user: {
          ...clientUser,
          kycStatus: "unverified",
          categoryInterestsOnboardingCompletedAt: null,
        },
        requestedNext: "/dashboard/bids",
        context: "sign-in",
        fullBuyerOnboardingEnabled: true,
        withWelcomeBack: true,
      }),
    ).toBe("/onboarding/interests?next=%2Fdashboard%2Fbids%3Fwelcome%3Dback&source=sign_in_resume");
  });

  it("preserves in-progress full onboarding destinations on login", () => {
    expect(
      resolvePostAuthDestination({
        user: {
          ...clientUser,
          kycStatus: "unverified",
          categoryInterestsOnboardingCompletedAt: new Date(),
        },
        requestedNext:
          "/onboarding/recommendations?next=%2Fdashboard%2Fwatchlist&source=post_verify",
        context: "sign-in",
        fullBuyerOnboardingEnabled: true,
      }),
    ).toBe("/onboarding/recommendations?next=%2Fdashboard%2Fwatchlist&source=post_verify");
  });

  it.each(["pending", "rejected"] as const)(
    "does not force identity onboarding for %s clients on redirect-if-authed",
    (kycStatus) => {
      expect(
        resolvePostAuthDestination({
          user: {
            ...clientUser,
            kycStatus,
            categoryInterestsOnboardingCompletedAt: new Date(),
          },
          context: "redirect-if-authed",
          fullBuyerOnboardingEnabled: true,
        }),
      ).toBe("/dashboard");
    },
  );

  it("does not redirect ineligible clients or when rollout is disabled", () => {
    for (const user of [
      clientUser,
      { ...clientUser, kycStatus: "unverified" as const, emailVerified: false },
      {
        ...clientUser,
        kycStatus: "unverified" as const,
        signupPersona: "organisation" as const,
      },
    ]) {
      expect(
        resolvePostAuthDestination({
          user,
          context: "sign-in",
        }),
      ).toBe("/dashboard");
    }

    expect(
      resolvePostAuthDestination({
        user: { ...clientUser, kycStatus: "unverified" },
        context: "sign-in",
      }),
    ).toBe("/dashboard");
  });

  it("does not wrap an existing identity onboarding destination", () => {
    expect(
      resolvePostAuthDestination({
        user: { ...clientUser, kycStatus: "unverified" },
        requestedNext: "/onboarding/identity/prepare?next=%2Fdashboard",
        context: "sign-in",
      }),
    ).toBe("/onboarding/identity/prepare?next=%2Fdashboard");
  });

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
    ).toBe("/register/verify-pending");
    expect(
      resolvePostAuthDestination({
        user: { ...clientUser, emailVerified: false },
        context: "redirect-if-authed",
        requireEmailVerification: true,
      }),
    ).toBe("/register/verify-pending");
    expect(
      resolvePostAuthDestination({
        user: { ...clientUser, emailVerified: false },
        requestedNext: "/dashboard/foo",
        context: "sign-up",
        requireEmailVerification: true,
      }),
    ).toBe("/register/verify-pending?next=%2Fdashboard%2Ffoo");
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

  it("routes content_marketing staff to /admin/artists after OAuth-style sign-in", () => {
    expect(
      resolvePostAuthDestination({
        user: {
          ...clientUser,
          role: "staff",
          staffRole: "content_marketing",
        },
        context: "sign-in",
        withWelcomeBack: true,
      }),
    ).toBe("/admin/artists?welcome=back");
  });

  it("ignores default client dashboard next for staff users", () => {
    const staffMarketing = {
      ...clientUser,
      role: "staff" as const,
      staffRole: "content_marketing" as const,
    };
    expect(
      resolvePostAuthDestination({
        user: staffMarketing,
        requestedNext: "/dashboard",
        context: "sign-in",
        withWelcomeBack: true,
      }),
    ).toBe("/admin/artists?welcome=back");
    expect(
      resolvePostAuthDestination({
        user: staffMarketing,
        requestedNext: "/dashboard/portfolio",
        context: "sign-in",
        withWelcomeBack: true,
      }),
    ).toBe("/admin/artists?welcome=back");
    expect(
      resolvePostAuthDestination({
        user: staffMarketing,
        requestedNext: "/sales/foo",
        context: "sign-in",
      }),
    ).toBe("/sales/foo");
  });

  it("allows staff to open seller submission routes", () => {
    const staffMarketing = {
      ...clientUser,
      role: "staff" as const,
      staffRole: "content_marketing" as const,
    };
    expect(
      resolvePostAuthDestination({
        user: staffMarketing,
        requestedNext: "/dashboard/submissions/new",
        context: "sign-in",
        withWelcomeBack: true,
      }),
    ).toBe("/dashboard/submissions/new?welcome=back");
    expect(
      resolvePostAuthDestination({
        user: staffMarketing,
        requestedNext: "/dashboard/submissions/new?categorySlug=motor-cars",
        context: "redirect-if-authed",
      }),
    ).toBe("/dashboard/submissions/new?categorySlug=motor-cars");
  });

  it("preserves client dashboard deep links", () => {
    expect(
      resolvePostAuthDestination({
        user: clientUser,
        requestedNext: "/dashboard/portfolio",
        context: "sign-in",
        withWelcomeBack: true,
      }),
    ).toBe("/dashboard/portfolio?welcome=back");
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
