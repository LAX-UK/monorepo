import { describe, expect, it } from "vitest";
import { accountInitials, buildProfileIncompleteBanner } from "./account-profile.vm.js";

describe("accountInitials", () => {
  it("uses first and last name initials", () => {
    expect(accountInitials("Ada Mary Collector", null)).toBe("AC");
    expect(accountInitials("ada", null)).toBe("A");
  });

  it("falls back to the email, then null", () => {
    expect(accountInitials(null, "zed@example.com")).toBe("Z");
    expect(accountInitials("  ", null)).toBeNull();
  });
});

describe("buildProfileIncompleteBanner", () => {
  const links = { verifyEmailHref: "/verify", laxAccountHref: "https://account.test" };
  const complete = { name: "Ada Collector", emailVerified: true, phone: "+44 7700", ...links };

  it("is hidden once name, verified email and phone are all present", () => {
    expect(buildProfileIncompleteBanner(complete)).toBeNull();
  });

  it("treats unknown verification as not blocking", () => {
    expect(buildProfileIncompleteBanner({ ...complete, emailVerified: null })).toBeNull();
  });

  it("prompts to verify an unverified email first, whatever else is missing", () => {
    expect(
      buildProfileIncompleteBanner({ ...complete, name: null, emailVerified: false, phone: null }),
    ).toMatchObject({ action: { label: "Verify email", href: "/verify" } });
  });

  it("prompts for a phone number via LAX Account when only the phone is missing", () => {
    expect(buildProfileIncompleteBanner({ ...complete, phone: " " })).toMatchObject({
      action: { label: "Add phone number", href: "https://account.test" },
    });
  });

  it("prompts for a name via LAX Account when only the name is missing", () => {
    expect(buildProfileIncompleteBanner({ ...complete, name: "  " })).toMatchObject({
      action: { label: "Add your name", href: "https://account.test" },
    });
  });

  it("uses the generic prompt when both name and phone are missing", () => {
    expect(buildProfileIncompleteBanner({ ...complete, name: null, phone: null })).toMatchObject({
      description: "Add a few more details to complete your account.",
      action: { label: "Complete account", href: "https://account.test" },
    });
  });

  it("omits the action when no deep link is configured", () => {
    expect(
      buildProfileIncompleteBanner({
        ...complete,
        phone: null,
        verifyEmailHref: null,
        laxAccountHref: null,
      }),
    ).toMatchObject({ action: null });
  });
});
