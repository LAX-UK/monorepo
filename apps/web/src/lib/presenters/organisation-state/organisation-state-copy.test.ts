import {
  type OrganisationBannerKey,
  type OrganisationBidReasonKey,
  type OrganisationHomeFirstRunKey,
  entityCapabilitiesOf,
  organisationStatePolicy,
} from "@auction/domain";
import {
  type LegalEntityMemberRole,
  legalEntityMemberRoles,
  legalEntityStatuses,
} from "@auction/types";
import { describe, expect, it } from "vitest";
import {
  type FirstRunStep,
  oneOfRoles,
  organisationBannerView,
  organisationBidReasonCopy,
  organisationFirstRunCopy,
} from "./organisation-state-copy";

const ctx = { organisationName: "Northbank Gallery" };

/** Every key, checked against the domain's unions so a new key fails here too. */
const BANNER_KEYS = Object.keys({
  documents_requested: true,
  documents_under_review: true,
  payouts_not_set_up: true,
  restricted: true,
  not_approved: true,
  archived: true,
} satisfies Record<OrganisationBannerKey, true>) as OrganisationBannerKey[];

const FIRST_RUN_KEYS = Object.keys({
  documents_requested: true,
  documents_under_review: true,
  payouts_not_set_up: true,
  ready: true,
  restricted: true,
  closed: true,
} satisfies Record<OrganisationHomeFirstRunKey, true>) as OrganisationHomeFirstRunKey[];

const BID_REASON_KEYS = Object.keys({
  documents_requested: true,
  documents_under_review: true,
  restricted: true,
  not_approved: true,
  archived: true,
} satisfies Record<OrganisationBidReasonKey, true>) as OrganisationBidReasonKey[];

const STEPS: FirstRunStep[] = ["sell", "invite", "none"];

/** Words a member must never read (system and vendor terms, raw values). */
const FORBIDDEN = /\b(KYB|KYC|Stripe|Connect|Veriff|2FA|entity|legal entity)\b|_/;

function expectPlainCopy(...texts: string[]) {
  for (const text of texts) {
    expect(text.trim().length).toBeGreaterThan(0);
    expect(text).not.toMatch(FORBIDDEN);
    expect(text.charAt(0)).toBe(text.charAt(0).toUpperCase());
  }
}

describe("organisation state copy: every key has words", () => {
  it.each(BANNER_KEYS)("banner %s, for those who act and those who are told", (key) => {
    for (const audience of ["act", "told"] as const) {
      const view = organisationBannerView({ kind: "info", key, audience }, ctx);
      expectPlainCopy(view.title, view.line);
      expect(view.title).toMatch(/\.$/);
      if (view.action) expectPlainCopy(view.action.label);
    }
  });

  it.each(FIRST_RUN_KEYS)("first run %s", (key) => {
    for (const step of STEPS) {
      const copy = organisationFirstRunCopy(key, step, ctx);
      expectPlainCopy(copy.title, copy.description);
      expect(`${copy.title} ${copy.description}`).toContain("Northbank Gallery");
    }
  });

  it.each(BID_REASON_KEYS)("bid reason %s", (key) => {
    const copy = organisationBidReasonCopy(key, ctx);
    expectPlainCopy(copy.title, copy.line);
    expect(copy.title).toContain("Northbank Gallery");
  });

  it("covers every status the policy can return", () => {
    for (const status of legalEntityStatuses) {
      for (const payoutsReady of [true, false]) {
        const policy = organisationStatePolicy(status, entityCapabilitiesOf({ role: "owner" }), {
          payoutsReady,
        });
        expect(FIRST_RUN_KEYS).toContain(policy.homeFirstRunKey);
        if (policy.banner) expect(BANNER_KEYS).toContain(policy.banner.key);
        if (policy.bidPanelReasonKey) expect(BID_REASON_KEYS).toContain(policy.bidPanelReasonKey);
      }
    }
  });
});

describe("banner audience", () => {
  const bannerFor = (role: LegalEntityMemberRole, status: "docs_requested" | "connect_pending") => {
    const banner = organisationStatePolicy(status, entityCapabilitiesOf({ role })).banner;
    return banner ? organisationBannerView(banner, ctx) : null;
  };

  it("asks owners and admins to send documents, and tells everyone else who can", () => {
    for (const role of legalEntityMemberRoles) {
      const view = bannerFor(role, "docs_requested");
      if (role === "owner" || role === "admin") {
        expect(view?.action).toMatchObject({ label: "Send documents", kind: "page" });
        expect(view?.line).not.toMatch(/can send them/);
      } else {
        expect(view?.action).toBeNull();
        expect(view?.line).toMatch(/An owner or admin can send them\.$/);
      }
    }
  });

  it("asks owners, admins and finance to set up payouts; consignors and viewers are told; buyer agents see nothing", () => {
    expect(bannerFor("finance", "connect_pending")?.action?.label).toBe("Set up payouts");
    expect(bannerFor("consignor", "connect_pending")?.line).toMatch(
      /An owner, admin or finance member can add one\.$/,
    );
    expect(bannerFor("viewer", "connect_pending")?.action).toBeNull();
    expect(bannerFor("buyer_agent", "connect_pending")).toBeNull();
  });

  it("offers everyone a way to contact us when only LAX can change the state", () => {
    for (const role of legalEntityMemberRoles) {
      const banner = organisationStatePolicy("restricted", entityCapabilitiesOf({ role })).banner;
      const view = banner ? organisationBannerView(banner, ctx) : null;
      expect(view).toMatchObject({ kind: "blocked", title: "Bidding and selling paused." });
      expect(view?.action).toMatchObject({ label: "Contact us", kind: "contact" });
      expect(view?.action?.href).toMatch(/^mailto:/);
    }
  });

  it("says what a restricted organisation can still do", () => {
    const view = organisationBannerView(
      { kind: "blocked", key: "restricted", audience: "told" },
      ctx,
    );
    expect(view.line).toBe(
      "Northbank Gallery can still see its history and pay its invoices. Contact us to find out more.",
    );
  });
});

describe("the bid panel reason", () => {
  it("says when bidding opens while documents are checked", () => {
    expect(organisationBidReasonCopy("documents_under_review", ctx)).toEqual({
      title: "Bidding for Northbank Gallery isn't open yet",
      line: "Bidding for Northbank Gallery opens once we've checked its documents.",
    });
  });

  it("never says the organisation can bid now", () => {
    for (const key of BID_REASON_KEYS) {
      const { title, line } = organisationBidReasonCopy(key, ctx);
      expect(`${title} ${line}`).not.toMatch(/can bid now/i);
    }
  });
});

describe("first run", () => {
  it("never invites a paused or unchecked organisation to sell", () => {
    for (const key of FIRST_RUN_KEYS.filter((k) => k !== "ready")) {
      const { description } = organisationFirstRunCopy(key, "sell", ctx);
      expect(description).not.toMatch(/Send a first work/);
    }
  });

  it("does not blame a trading organisation when this role has nothing to show", () => {
    const copy = organisationFirstRunCopy("ready", "none", ctx);
    expect(copy.description).not.toMatch(/starts selling or buying/);
  });
});

describe("oneOfRoles", () => {
  it("reads as one of a group, with the right article", () => {
    expect(oneOfRoles(["owner", "admin"])).toBe("An owner or admin");
    expect(oneOfRoles(["owner", "admin", "finance"])).toBe("An owner, admin or finance member");
    expect(oneOfRoles(["finance"])).toBe("A finance member");
    expect(oneOfRoles(["owner", "admin"], "inside")).toBe("an owner or admin");
    expect(oneOfRoles([])).toBe("");
  });
});
