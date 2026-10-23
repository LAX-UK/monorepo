import { buildAccountLinks } from "@/server/domain/account-links";
import { buildSecurityCheckup } from "@/server/domain/account-security-checkup.vm";
import type { AccountSecurityFacts } from "@/server/domain/account-security-facts";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { SecurityCheckupCard } from "./security-checkup-card";

const links = buildAccountLinks({
  oidcIssuer: "https://test-auth.lax.bid",
  oidcClientId: "lax-account-web",
  bidPublicUrl: "https://test.lax.bid",
});

const base: AccountSecurityFacts = {
  hasEmail: true,
  emailVerified: false,
  hasPhone: false,
  phoneVerified: false,
  twoStepConfirmed: false,
};

const render = (facts: AccountSecurityFacts) =>
  renderToStaticMarkup(<SecurityCheckupCard checkup={buildSecurityCheckup(facts, links)} />);

describe("SecurityCheckupCard", () => {
  it("shows 0 of 3 with an action link for every step", () => {
    const html = render(base);
    expect(html).toContain("0 of 3 recommended steps done");
    expect(html).toContain('aria-valuenow="0"');
    expect(html).toContain('aria-valuemax="3"');
    expect(html).toContain("Verify email: Verify your email");
    expect(html).toContain("Set up or review: Turn on two-step verification");
    expect(html).toContain("Add phone: Add a phone number");
    expect(html).not.toContain("Nothing needs your attention");
  });

  it("shows partial progress and drops the action of a finished step", () => {
    const html = render({ ...base, emailVerified: true, twoStepConfirmed: true });
    expect(html).toContain("2 of 3 recommended steps done");
    expect(html).toContain('aria-valuenow="2"');
    expect(html).toContain('Verify your email<span class="sr-only"> (done)</span>');
    expect(html).not.toContain("Verify email: Verify your email");
    expect(html).toContain("Add phone: Add a phone number");
  });

  it("confirms calmly when everything is done, in green rather than the accent", () => {
    const html = render({
      hasEmail: true,
      emailVerified: true,
      hasPhone: true,
      phoneVerified: true,
      twoStepConfirmed: true,
    });
    expect(html).toContain("3 of 3 recommended steps done");
    expect(html).toContain("Your account is up to date. Nothing needs your attention right now.");
    expect(html).toContain("<output");
    expect(html).toContain("bg-success-container");
    expect(html).not.toContain('aria-label="Verify email');
  });

  it("tints the ring with the product accent and never marks a step done in teal", () => {
    const html = render(base);
    expect(html).toContain("text-product-accent");
    expect(render({ ...base, emailVerified: true })).toContain("text-success");
  });
});
