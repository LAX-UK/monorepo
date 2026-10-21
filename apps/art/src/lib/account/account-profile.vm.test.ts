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

  it("is hidden once email is verified and a phone exists", () => {
    expect(
      buildProfileIncompleteBanner({ emailVerified: true, phone: "+44 7700", ...links }),
    ).toBeNull();
  });

  it("treats unknown verification as not blocking", () => {
    expect(
      buildProfileIncompleteBanner({ emailVerified: null, phone: "+44 7700", ...links }),
    ).toBeNull();
  });

  it("prompts to verify an unverified email first", () => {
    expect(
      buildProfileIncompleteBanner({ emailVerified: false, phone: null, ...links }),
    ).toMatchObject({
      action: { label: "Verify email", href: "/verify" },
    });
  });

  it("prompts for a phone number via LAX Account when only the phone is missing", () => {
    expect(
      buildProfileIncompleteBanner({ emailVerified: true, phone: " ", ...links }),
    ).toMatchObject({
      action: { label: "Add phone number", href: "https://account.test" },
    });
  });

  it("omits the action when no deep link is configured", () => {
    expect(
      buildProfileIncompleteBanner({
        emailVerified: true,
        phone: null,
        verifyEmailHref: null,
        laxAccountHref: null,
      }),
    ).toMatchObject({ action: null });
  });
});
