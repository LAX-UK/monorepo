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
  twoStep: "unknown",
  hasPassword: true,
  backupCodesRemaining: null,
  otherSessionCount: null,
};

const overview = {
  email: "ada@example.com",
  emailVerified: true,
  signedInWithAuthenticator: false,
};

describe("readAccountSecurityFacts", () => {
  it("uses the issuer's answer: enrolled with a count", () => {
    expect(
      readAccountSecurityFacts(overview, {
        twoFactorEnabled: true,
        hasPassword: true,
        backupCodesRemaining: 2,
      }),
    ).toEqual({
      hasEmail: true,
      emailVerified: true,
      twoStep: "on",
      hasPassword: true,
      backupCodesRemaining: 2,
      otherSessionCount: null,
    });
  });

  it("counts the other devices, never this one, and leaves the count unknown without an answer", () => {
    const session = (id: string, isCurrent: boolean) => ({
      id,
      isCurrent,
      userAgent: null,
      createdAt: "2026-10-23T12:00:00.000Z",
      lastActiveAt: "2026-10-23T12:00:00.000Z",
      signedInWith: null,
    });
    expect(
      readAccountSecurityFacts(overview, null, [session("a", true), session("b", false)])
        .otherSessionCount,
    ).toBe(1);
    expect(readAccountSecurityFacts(overview, null, [session("a", true)]).otherSessionCount).toBe(
      0,
    );
    expect(readAccountSecurityFacts(overview, null, null).otherSessionCount).toBeNull();
  });

  it("says off only when the issuer says so, and ignores a stale authenticator sign-in", () => {
    const facts = readAccountSecurityFacts(
      { ...overview, signedInWithAuthenticator: true },
      { twoFactorEnabled: false, hasPassword: true, backupCodesRemaining: null },
    );
    expect(facts.twoStep).toBe("off");
    expect(facts.backupCodesRemaining).toBeNull();
  });

  it("is on with an unknown count when the issuer could not count the codes", () => {
    const facts = readAccountSecurityFacts(overview, {
      twoFactorEnabled: true,
      hasPassword: true,
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
  it("starts at 0 of 3 with an action and a link on every step", () => {
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
      ["sessions", false, "Review devices", "/account/security#signed-in-devices"],
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

  it("links the backup codes step to the regenerate action on the security page and counts it as open", () => {
    const checkup = buildSecurityCheckup(
      { ...none, twoStep: "on", backupCodesRemaining: 1 },
      links,
    );
    const step = checkup.steps.find((s) => s.id === "backup-codes");
    expect(step).toMatchObject({
      done: false,
      actionLabel: "Get new codes",
      href: "/account/security#backup-codes",
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

  it("reviews where the person is signed in: done only when this is the one device", () => {
    const step = (otherSessionCount: number | null) =>
      buildSecurityCheckup({ ...none, otherSessionCount }, links).steps.find(
        (s) => s.id === "sessions",
      );
    expect(step(null)).toMatchObject({ done: false, actionLabel: "Review devices" });
    expect(step(0)).toMatchObject({
      done: true,
      actionLabel: null,
      description: "You're only signed in on this device.",
    });
    expect(step(1)?.description).toBe(
      "You're also signed in on 1 other device. Sign out any you don't recognise.",
    );
    expect(step(3)).toMatchObject({ done: false, actionLabel: "Review devices" });
    expect(step(3)?.description).toContain("3 other devices");
  });

  it("is complete when every step is done", () => {
    const checkup = buildSecurityCheckup(
      {
        hasEmail: true,
        emailVerified: true,
        twoStep: "on",
        hasPassword: true,
        backupCodesRemaining: 8,
        otherSessionCount: 0,
      },
      links,
    );
    expect(checkup).toMatchObject({ doneCount: 3, total: 3, complete: true });
    expect(checkup.steps.every((s) => s.actionLabel === null)).toBe(true);
  });

  it("omits steps that do not apply", () => {
    const checkup = buildSecurityCheckup({ ...none, hasEmail: false }, links);
    expect(checkup.steps.map((s) => s.id)).toEqual(["two-step", "sessions"]);
    expect(checkup.summary).toBe("0 of 2 recommended steps done");
  });
});

describe("the passkey step", () => {
  const ids = (passkeys: Parameters<typeof buildSecurityCheckup>[2]) =>
    buildSecurityCheckup({ ...none, twoStep: "on" }, links, passkeys).steps.map((step) => step.id);

  it("asks to add one only where passkeys are offered and the person has none", () => {
    expect(ids({ offered: true, count: 0 })).toContain("passkey");
    const step = buildSecurityCheckup({ ...none, twoStep: "on" }, links, {
      offered: true,
      count: 0,
    }).steps.find((entry) => entry.id === "passkey");
    expect(step).toMatchObject({
      title: "Add a passkey",
      description: "Sign in with your face or fingerprint.",
      done: false,
      actionLabel: "Add a passkey",
      href: "/account/security#sign-in-methods",
    });
  });

  it("leaves the checkup as it was when passkeys are off, already held, or unknown", () => {
    const before = ids(null);
    expect(ids({ offered: false, count: 0 })).toEqual(before);
    expect(ids({ offered: true, count: 2 })).toEqual(before);
    expect(before).not.toContain("passkey");
  });
});
