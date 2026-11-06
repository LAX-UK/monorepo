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
  twoStep: "unknown",
  hasPassword: true,
  backupCodesRemaining: null,
  otherSessionCount: null,
};

const render = (facts: AccountSecurityFacts) =>
  renderToStaticMarkup(<SecurityCheckupCard checkup={buildSecurityCheckup(facts, links)} />);

describe("SecurityCheckupCard", () => {
  it("is one compact row with a 40px ring, progress and a way in", () => {
    const html = render(base);
    expect(html).toContain("Security checkup · 0 of 3 done");
    expect(html).toContain('aria-valuenow="0"');
    expect(html).toContain('aria-valuemax="3"');
    expect(html).toContain('width="40"');
    expect(html).toContain(">Review<");
    expect(html).not.toContain("<ul");
  });

  it("lists what is left and drops nothing into a long step list", () => {
    const html = render({ ...base, emailVerified: true, twoStep: "on" });
    expect(html).toContain("Security checkup · 2 of 3 done");
    expect(html).toContain("Review where you&#x27;re signed in.");
  });

  it("confirms calmly when everything is done, in green rather than the accent", () => {
    const html = render({ ...base, emailVerified: true, twoStep: "on", otherSessionCount: 0 });
    expect(html).toContain("Security checkup · all 3 done");
    expect(html).toContain("text-success");
    expect(html).not.toContain(">Review<");
    expect(html).not.toContain("text-product-accent");
  });

  it("tints the ring with the product accent while steps are open", () => {
    expect(render(base)).toContain("text-product-accent");
  });
});
