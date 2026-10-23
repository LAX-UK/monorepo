import { describe, expect, it } from "vitest";
import { buildAccountLinks } from "./account-links";
import { buildProfileSections } from "./account-profile.vm";

const withBid = buildAccountLinks({
  oidcIssuer: "https://test-auth.lax.bid",
  oidcClientId: "lax-account-web",
  bidPublicUrl: "https://test.lax.bid",
});
const withoutBid = buildAccountLinks({
  oidcIssuer: "https://test-auth.lax.bid",
  oidcClientId: "lax-account-web",
});

const overview = {
  email: "shima@example.com",
  emailVerified: true,
  phone: "+201234567890",
  phoneVerified: false,
};

describe("buildProfileSections", () => {
  it("masks the email and links no other product for email or phone", () => {
    const sections = buildProfileSections(overview, withBid);
    expect(sections.map((s) => s.id)).toEqual(["email", "phone", "addresses"]);
    expect(sections[0]?.fields[0]).toEqual({
      label: "Email address",
      value: "s***@example.com",
      status: { label: "Verified", tone: "success" },
    });
    expect(sections[1]?.fields[0]?.status).toEqual({ label: "Not verified", tone: "neutral" });
    for (const section of sections.slice(0, 2)) {
      expect(section.note).toMatch(/can't .* here yet/);
      expect(section.actions).toEqual([
        { label: "Contact us", href: "https://test.lax.bid/contact" },
      ]);
    }
    expect(sections[2]?.actions[0]?.href).toBe("https://test.lax.bid/dashboard/settings/addresses");
  });

  it("offers the hosted verify step for an unverified email", () => {
    const [email] = buildProfileSections({ ...overview, emailVerified: false }, withBid);
    expect(email?.actions.map((a) => a.label)).toEqual(["Verify email", "Contact us"]);
  });

  it("shows missing values without a status and hides Bid-only parts without Bid", () => {
    const sections = buildProfileSections(
      { email: null, emailVerified: false, phone: null, phoneVerified: false },
      withoutBid,
    );
    expect(sections.map((s) => s.id)).toEqual(["email", "phone"]);
    expect(sections.flatMap((s) => s.actions)).toEqual([]);
    expect(sections[1]?.fields[0]).toEqual({ label: "Phone number", value: null });
  });
});
