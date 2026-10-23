import { describe, expect, it } from "vitest";
import { buildAccountLinks } from "./account-links";
import { buildSecurityCheckup } from "./account-security-checkup.vm";
import { type AccountSecurityFacts, readAccountSecurityFacts } from "./account-security-facts";

const links = buildAccountLinks(
  {
    oidcIssuer: "https://test-auth.lax.bid",
    oidcClientId: "lax-account-web",
    bidPublicUrl: "https://test.lax.bid",
  },
  { email: "ada@example.com" },
);

const none: AccountSecurityFacts = {
  hasEmail: true,
  emailVerified: false,
  hasPhone: false,
  phoneVerified: false,
  twoStep: "unknown",
  backupCodesRemaining: null,
};

const overview = {
  email: "ada@example.com",
  emailVerified: true,
  phone: "+201000000000",
  phoneVerified: false,
  signedInWithAuthenticator: false,
};

describe("readAccountSecurityFacts", () => {
  it("uses the issuer's answer: enrolled with a count", () => {
    expect(
      readAccountSecurityFacts(overview, { twoFactorEnabled: true, backupCodesRemaining: 2 }),
    ).toEqual({
      hasEmail: true,
      emailVerified: true,
      hasPhone: true,
      phoneVerified: false,
      twoStep: "on",
      backupCodesRemaining: 2,
    });
  });

  it("says off only when the issuer says so, and ignores a stale authenticator sign-in", () => {
    const facts = readAccountSecurityFacts(
      { ...overview, signedInWithAuthenticator: true },
      { twoFactorEnabled: false, backupCodesRemaining: null },
    );
    expect(facts.twoStep).toBe("off");
    expect(facts.backupCodesRemaining).toBeNull();
  });

  it("is on with an unknown count when the issuer could not count the codes", () => {
    const facts = readAccountSecurityFacts(overview, {
      twoFactorEnabled: true,
      backupCodesRemaining: null,
    });
    expect(facts).toMatchObject({ twoStep: "on", backupCodesRemaining: null });
  });

  it("falls back to the sign-in when the issuer cannot be asked: a second factor proves on", () => {
    expect(
      readAccountSecurityFacts({ ...overview, signedInWithAuthenticator: true }, null),
    ).toMatchObject({ twoStep: "on", backupCodesRemaining: null });
  });

  it("falls back to unknown, never off, without proof", () => {
    expect(readAccountSecurityFacts(overview, null).twoStep).toBe("unknown");
  });

  it("never treats a missing email as verified", () => {
    const facts = readAccountSecurityFacts({ ...overview, email: null }, null);
    expect(facts.hasEmail).toBe(false);
    expect(facts.emailVerified).toBe(false);
  });
});

describe("buildSecurityCheckup", () => {
  it("starts at 0 of 3 with an action and a hosted or Bid link on every step", () => {
    const checkup = buildSecurityCheckup(none, links);
    expect(checkup.summary).toBe("0 of 3 recommended steps done");
    expect(checkup.complete).toBe(false);
    expect(checkup.steps.map((s) => [s.id, s.done, s.actionLabel, s.href])).toEqual([
      [
        "verify-email",
        false,
        "Verify email",
        "https://test-auth.lax.bid/resend-verification?client_id=lax-account-web&email=ada%40example.com",
      ],
      [
        "two-step",
        false,
        "Set up or review",
        "https://test-auth.lax.bid/two-factor/manage?client_id=lax-account-web",
      ],
      ["phone", false, "Add phone", "https://test.lax.bid/dashboard/settings/profile"],
    ]);
  });

  it("offers a clear 'Turn on' when the issuer says two-step is off", () => {
    const step = buildSecurityCheckup({ ...none, twoStep: "off" }, links).steps[1];
    expect(step).toMatchObject({ id: "two-step", done: false, actionLabel: "Turn on" });
  });

  it("marks two-step done when enrolled, even if this sign-in did not use it", () => {
    const step = buildSecurityCheckup({ ...none, twoStep: "on" }, links).steps[1];
    expect(step).toMatchObject({ id: "two-step", done: true, actionLabel: null });
  });

  it("asks for new backup codes only when enrolled and 3 or fewer remain", () => {
    const ids = (backupCodesRemaining: number | null, twoStep: "on" | "off" | "unknown" = "on") =>
      buildSecurityCheckup({ ...none, twoStep, backupCodesRemaining }, links).steps.map(
        (s) => s.id,
      );
    expect(ids(3)).toContain("backup-codes");
    expect(ids(0)).toContain("backup-codes");
    expect(ids(4)).not.toContain("backup-codes");
    expect(ids(null)).not.toContain("backup-codes");
    expect(ids(2, "off")).not.toContain("backup-codes");
    expect(ids(2, "unknown")).not.toContain("backup-codes");
  });

  it("links the backup codes step to the hosted two-step page and counts it as open", () => {
    const checkup = buildSecurityCheckup(
      { ...none, twoStep: "on", backupCodesRemaining: 1 },
      links,
    );
    const step = checkup.steps.find((s) => s.id === "backup-codes");
    expect(step).toMatchObject({
      done: false,
      actionLabel: "Get new codes",
      href: "https://test-auth.lax.bid/two-factor/manage?client_id=lax-account-web",
    });
    expect(step?.description).toBe(
      "You have 1 backup code left. Create a new set before they run out.",
    );
    expect(checkup.total).toBe(4);
  });

  it("says plainly when no backup codes are left", () => {
    const step = buildSecurityCheckup(
      { ...none, twoStep: "on", backupCodesRemaining: 0 },
      links,
    ).steps.find((s) => s.id === "backup-codes");
    expect(step?.description).toContain("no backup codes left");
  });

  it("counts finished steps and drops their action", () => {
    const checkup = buildSecurityCheckup({ ...none, emailVerified: true }, links);
    expect(checkup.summary).toBe("1 of 3 recommended steps done");
    expect(checkup.steps[0]).toMatchObject({ done: true, actionLabel: null });
    expect(checkup.complete).toBe(false);
  });

  it("asks to verify a phone number that was added but not verified", () => {
    const checkup = buildSecurityCheckup({ ...none, hasPhone: true }, links);
    expect(checkup.steps[2]).toMatchObject({ actionLabel: "Verify phone", done: false });
  });

  it("is complete when every step is done", () => {
    const checkup = buildSecurityCheckup(
      {
        hasEmail: true,
        emailVerified: true,
        hasPhone: true,
        phoneVerified: true,
        twoStep: "on",
        backupCodesRemaining: 8,
      },
      links,
    );
    expect(checkup).toMatchObject({ doneCount: 3, total: 3, complete: true });
    expect(checkup.steps.every((s) => s.actionLabel === null)).toBe(true);
  });

  it("omits steps that do not apply or have nowhere to go", () => {
    const noBid = buildAccountLinks({
      oidcIssuer: "https://test-auth.lax.bid",
      oidcClientId: "lax-account-web",
    });
    const checkup = buildSecurityCheckup({ ...none, hasEmail: false }, noBid);
    expect(checkup.steps.map((s) => s.id)).toEqual(["two-step"]);
    expect(checkup.summary).toBe("0 of 1 recommended steps done");
  });
});
