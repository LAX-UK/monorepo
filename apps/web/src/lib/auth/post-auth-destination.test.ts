import {
  isSafeNextPath,
  resolvePostAuthDestination,
  resolveSilentPostLoginDestination,
} from "@/lib/auth/post-auth-destination";
import { staffRoleDefaultDestination } from "@auction/types";
import { describe, expect, it } from "vitest";

const clientUser = {
  role: "client" as const,
  staffRoles: [],
  email: "a@b.com",
  emailVerified: true,
  kycStatus: "approved" as const,
  signupPersona: "individual" as const,
  suspended: false as const,
};

describe("isSafeNextPath", () => {
  it("accepts safe internal paths", () => {
    expect(isSafeNextPath("/home")).toBe(true);
    expect(isSafeNextPath("/purchases")).toBe(true);
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
    expect(isSafeNextPath("/%252f%252fevil.com")).toBe(false);
    expect(isSafeNextPath("/%2525252f%2525252fevil.com")).toBe(false);
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
    expect(staffRoleDefaultDestination("staff", ["administrator"])).toBe("/admin");
    expect(staffRoleDefaultDestination("staff", ["finance"])).toBe("/admin/finance");
    expect(staffRoleDefaultDestination("staff", ["read_only"])).toBe("/admin/legal-entities");
    expect(staffRoleDefaultDestination("client", [])).toBe("/home");
  });

  it("never sends staff to /home", () => {
    expect(staffRoleDefaultDestination("staff", [])).toBe("/admin");
    expect(staffRoleDefaultDestination("staff", ["read_only"])).not.toBe("/home");
  });
});

describe("resolvePostAuthDestination", () => {
  it("sends clients with incomplete account onboarding to /onboarding/account", () => {
    expect(
      resolvePostAuthDestination({
        user: { ...clientUser, accountOnboardingComplete: false },
        requestedNext: "/bids",
        context: "sign-in",
      }),
    ).toBe("/onboarding/account?next=%2Fbids");
  });

  it("skips account onboarding redirect for staff", () => {
    expect(
      resolvePostAuthDestination({
        user: {
          ...clientUser,
          role: "staff",
          staffRoles: ["administrator"],
          accountOnboardingComplete: false,
        },
        context: "sign-in",
      }),
    ).toBe("/admin");
  });

  it("sends unapproved clients to their requested destination on login", () => {
    expect(
      resolvePostAuthDestination({
        user: {
          ...clientUser,
          kycStatus: "unverified",
          categoryInterestsOnboardingCompletedAt: new Date(),
        },
        requestedNext: "/bids",
        context: "sign-in",
        fullBuyerOnboardingEnabled: true,
        withWelcomeBack: true,
      }),
    ).toBe("/bids?welcome=back");
  });

  it("starts the full interests flow on login when onboarding is still incomplete", () => {
    expect(
      resolvePostAuthDestination({
        user: {
          ...clientUser,
          kycStatus: "unverified",
          categoryInterestsOnboardingCompletedAt: null,
        },
        requestedNext: "/bids",
        context: "sign-in",
        fullBuyerOnboardingEnabled: true,
        withWelcomeBack: true,
      }),
    ).toBe("/onboarding/interests?next=%2Fbids%3Fwelcome%3Dback&source=sign_in_resume");
  });

  it("preserves in-progress full onboarding destinations on login", () => {
    expect(
      resolvePostAuthDestination({
        user: {
          ...clientUser,
          kycStatus: "unverified",
          categoryInterestsOnboardingCompletedAt: new Date(),
        },
        requestedNext: "/onboarding/recommendations?next=%2Fwatching&source=post_verify",
        context: "sign-in",
        fullBuyerOnboardingEnabled: true,
      }),
    ).toBe("/onboarding/recommendations?next=%2Fwatching&source=post_verify");
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
      ).toBe("/home");
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
      ).toBe("/home");
    }

    expect(
      resolvePostAuthDestination({
        user: { ...clientUser, kycStatus: "unverified" },
        context: "sign-in",
      }),
    ).toBe("/home");
  });

  it("does not wrap an existing identity onboarding destination", () => {
    expect(
      resolvePostAuthDestination({
        user: { ...clientUser, kycStatus: "unverified" },
        requestedNext: "/onboarding/identity/prepare?next=%2Fhome",
        context: "sign-in",
      }),
    ).toBe("/onboarding/identity/prepare?next=%2Fhome");
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
        requestedNext: "/home/foo",
        context: "sign-up",
        requireEmailVerification: true,
      }),
    ).toBe("/register/verify-pending?next=%2Fhome%2Ffoo");
  });

  it("uses safe next when present", () => {
    expect(
      resolvePostAuthDestination({
        user: clientUser,
        requestedNext: "/bids",
        context: "sign-in",
      }),
    ).toBe("/bids");
  });

  it("falls back to role default when next is unsafe", () => {
    expect(
      resolvePostAuthDestination({
        user: clientUser,
        requestedNext: "//evil.com",
        context: "sign-in",
      }),
    ).toBe("/home");
    expect(
      resolvePostAuthDestination({
        user: { ...clientUser, role: "staff", staffRoles: ["administrator"] },
        requestedNext: "//evil",
        context: "sign-in",
      }),
    ).toBe("/admin");
  });

  it("routes read_only staff to /admin/legal-entities after OAuth-style sign-in", () => {
    expect(
      resolvePostAuthDestination({
        user: {
          ...clientUser,
          role: "staff",
          staffRoles: ["read_only"],
        },
        context: "sign-in",
        withWelcomeBack: true,
      }),
    ).toBe("/admin/legal-entities?welcome=back");
  });

  it("ignores default client dashboard next for staff users", () => {
    const staffMarketing = {
      ...clientUser,
      role: "staff" as const,
      staffRoles: ["read_only"] as const,
    };
    expect(
      resolvePostAuthDestination({
        user: staffMarketing,
        requestedNext: "/home",
        context: "sign-in",
        withWelcomeBack: true,
      }),
    ).toBe("/admin/legal-entities?welcome=back");
    expect(
      resolvePostAuthDestination({
        user: staffMarketing,
        requestedNext: "/purchases",
        context: "sign-in",
        withWelcomeBack: true,
      }),
    ).toBe("/admin/legal-entities?welcome=back");
    expect(
      resolvePostAuthDestination({
        user: staffMarketing,
        requestedNext: "/sales/foo",
        context: "sign-in",
      }),
    ).toBe("/sales/foo");
  });

  it("sends staff to admin instead of the client submission form", () => {
    const staffMarketing = {
      ...clientUser,
      role: "staff" as const,
      staffRoles: ["read_only"] as const,
    };
    expect(
      resolvePostAuthDestination({
        user: staffMarketing,
        requestedNext: "/selling/new",
        context: "sign-in",
        withWelcomeBack: true,
      }),
    ).toBe("/admin/legal-entities?welcome=back");
    expect(
      resolvePostAuthDestination({
        user: staffMarketing,
        requestedNext: "/selling/new?categorySlug=motor-cars",
        context: "redirect-if-authed",
      }),
    ).toBe("/admin/legal-entities");
  });

  it("preserves client dashboard deep links", () => {
    expect(
      resolvePostAuthDestination({
        user: clientUser,
        requestedNext: "/purchases",
        context: "sign-in",
        withWelcomeBack: true,
      }),
    ).toBe("/purchases?welcome=back");
  });

  it("appends welcome=back", () => {
    expect(
      resolvePostAuthDestination({
        user: clientUser,
        requestedNext: "/purchases",
        context: "sign-in",
        withWelcomeBack: true,
      }),
    ).toBe("/purchases?welcome=back");
    expect(
      resolvePostAuthDestination({
        user: clientUser,
        context: "sign-in",
        withWelcomeBack: true,
      }),
    ).toBe("/home?welcome=back");
  });
});

describe("resolveSilentPostLoginDestination", () => {
  it("honours requested next without forcing onboarding", () => {
    expect(resolveSilentPostLoginDestination(clientUser, "/catalog")).toBe("/catalog");
  });

  it("sends suspended users to account-suspended", () => {
    expect(resolveSilentPostLoginDestination({ ...clientUser, suspended: true }, "/catalog")).toBe(
      "/account-suspended",
    );
  });

  it("defaults to home when next is missing", () => {
    expect(resolveSilentPostLoginDestination(clientUser, null)).toBe("/");
  });
});
