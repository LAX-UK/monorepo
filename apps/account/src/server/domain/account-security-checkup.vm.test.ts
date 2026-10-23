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
  twoStepConfirmed: false,
};

describe("readAccountSecurityFacts", () => {
  it("maps the overview without inventing anything", () => {
    expect(
      readAccountSecurityFacts({
        email: "ada@example.com",
        emailVerified: true,
        phone: "+201000000000",
        phoneVerified: false,
        signedInWithAuthenticator: true,
      }),
    ).toEqual({
      hasEmail: true,
      emailVerified: true,
      hasPhone: true,
      phoneVerified: false,
      twoStepConfirmed: true,
    });
  });

  it("never treats a missing email as verified", () => {
    const facts = readAccountSecurityFacts({
      email: null,
      emailVerified: true,
      phone: null,
      phoneVerified: false,
      signedInWithAuthenticator: false,
    });
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
        twoStepConfirmed: true,
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
