import { legalEntityMemberRoles, legalEntityStatuses } from "@auction/types";
import type { LegalEntityMemberRole, LegalEntityStatus } from "@auction/types";
import { describe, expect, it } from "vitest";
import { buyerEntityCanBid, buyerEntityCanRegister } from "./buyer-entity-bid-eligibility.js";
import { entityCapabilitiesOf } from "./entity-capabilities.js";
import {
  ORGANISATION_ACTIONS,
  ORGANISATION_CLOSED_TO_MEMBERS,
  ORGANISATION_RESTRICTED_MEMBERS,
  type OrganisationAction,
  organisationBannerActors,
  organisationInviteRefusal,
  organisationStatePolicy,
  organisationUnsoldChoiceRefusal,
} from "./organisation-state-policy.js";
import { organisationBidRefusalMessage } from "./organisation-state-refusal.js";

const NONE = new Set<never>();
const forRole = (role: LegalEntityMemberRole) => entityCapabilitiesOf({ role });

/** The expected table: one row per status, the actions it allows. */
const ALLOWED: Record<LegalEntityStatus, readonly OrganisationAction[]> = {
  lead: ["read_history", "invite", "accept_invitation", "send_documents", "message_specialist"],
  docs_requested: [
    "read_history",
    "invite",
    "accept_invitation",
    "send_documents",
    "message_specialist",
  ],
  docs_received: ["read_history", "invite", "accept_invitation", "message_specialist"],
  under_review: ["read_history", "invite", "accept_invitation", "message_specialist"],
  connect_pending: [
    "bid",
    "register",
    "pay",
    "read_history",
    "invite",
    "accept_invitation",
    "set_up_payouts",
    "message_specialist",
  ],
  approved: ORGANISATION_ACTIONS.filter((action) => action !== "send_documents"),
  restricted: ["pay", "read_history"],
  rejected: ["read_history"],
  archived: ["read_history"],
};

describe("organisationStatePolicy actions", () => {
  const rows = legalEntityStatuses.flatMap((status) =>
    ORGANISATION_ACTIONS.map((action) => [status, action] as const),
  );

  it.each(rows)("%s / %s", (status, action) => {
    expect(organisationStatePolicy(status, NONE).actions[action]).toBe(
      ALLOWED[status].includes(action),
    );
  });

  it("lets a restricted organisation read and pay, but not trade or add people", () => {
    const { actions } = organisationStatePolicy("restricted", NONE);
    const on = Object.entries(actions)
      .filter(([, allowed]) => allowed)
      .map(([name]) => name);
    expect(on).toEqual(["pay", "read_history"]);
  });

  it("never lets a restricted, rejected or archived organisation take new members", () => {
    for (const status of ["restricted", "rejected", "archived"] as const) {
      expect(organisationStatePolicy(status, NONE).actions.accept_invitation).toBe(false);
    }
  });
});

describe("organisationStatePolicy bid panel and first run", () => {
  it("gives a reason exactly when bidding is closed", () => {
    for (const status of legalEntityStatuses) {
      const policy = organisationStatePolicy(status, NONE);
      expect(policy.bidPanelReasonKey === null).toBe(policy.actions.bid);
    }
  });

  it("has a first-run key for every status", () => {
    const keys = Object.fromEntries(
      legalEntityStatuses.map((status) => [
        status,
        organisationStatePolicy(status, NONE).homeFirstRunKey,
      ]),
    );
    expect(keys).toEqual({
      lead: "documents_requested",
      docs_requested: "documents_requested",
      docs_received: "documents_under_review",
      under_review: "documents_under_review",
      connect_pending: "payouts_not_set_up",
      approved: "ready",
      restricted: "restricted",
      rejected: "closed",
      archived: "closed",
    });
  });

  it("tells an approved organisation without payouts like one setting them up", () => {
    const policy = organisationStatePolicy("approved", forRole("owner"), { payoutsReady: false });
    expect(policy.homeFirstRunKey).toBe("payouts_not_set_up");
    expect(policy.banner).toEqual({
      kind: "attention",
      key: "payouts_not_set_up",
      audience: "act",
    });
    expect(organisationStatePolicy("approved", forRole("owner")).banner).toBeNull();
  });
});

describe("organisationStatePolicy banner audience", () => {
  const banner = (status: LegalEntityStatus, role: LegalEntityMemberRole) =>
    organisationStatePolicy(status, forRole(role)).banner;

  it("asks owners and admins for requested documents; every other role is told", () => {
    for (const role of legalEntityMemberRoles) {
      expect(banner("docs_requested", role)).toEqual({
        kind: "attention",
        key: "documents_requested",
        audience: role === "owner" || role === "admin" ? "act" : "told",
      });
    }
  });

  it("only tells every role while documents are under review", () => {
    for (const role of legalEntityMemberRoles) {
      expect(banner("under_review", role)).toEqual({
        kind: "info",
        key: "documents_under_review",
        audience: "told",
      });
    }
  });

  it("asks owners, admins and finance to set up payouts; those who follow consignments are told; a buyer agent sees nothing", () => {
    expect(banner("connect_pending", "owner")?.audience).toBe("act");
    expect(banner("connect_pending", "admin")?.audience).toBe("act");
    expect(banner("connect_pending", "finance")?.audience).toBe("act");
    expect(banner("connect_pending", "consignor")?.audience).toBe("told");
    expect(banner("connect_pending", "buyer_agent")).toBeNull();
    expect(banner("connect_pending", "viewer")?.audience).toBe("told");
  });

  it("tells every role a restricted organisation is blocked, so a buyer agent sees why", () => {
    for (const role of legalEntityMemberRoles) {
      expect(banner("restricted", role)).toEqual({
        kind: "blocked",
        key: "restricted",
        audience: "told",
      });
    }
  });

  it("treats an impersonating admin as a reader: told, never asked", () => {
    const capabilities = entityCapabilitiesOf({ role: "owner", isImpersonation: true });
    expect(organisationStatePolicy("docs_requested", capabilities).banner?.audience).toBe("told");
  });

  it("shows nothing for an approved organisation", () => {
    for (const role of legalEntityMemberRoles) expect(banner("approved", role)).toBeNull();
  });
});

describe("bidding and registering share one rule", () => {
  it.each(legalEntityStatuses)("%s", (status) => {
    const { actions } = organisationStatePolicy(status, NONE);
    expect(buyerEntityCanBid(status)).toBe(actions.bid);
    expect(buyerEntityCanRegister(status)).toBe(actions.register);
    expect(buyerEntityCanRegister(status)).toBe(buyerEntityCanBid(status));
  });

  it("explains every refusal and nothing else", () => {
    for (const status of legalEntityStatuses) {
      expect(organisationBidRefusalMessage(status) === null).toBe(buyerEntityCanBid(status));
    }
  });
});

describe("choosing what happens to unsold works", () => {
  it.each(legalEntityStatuses)("is open exactly where submitting is (%s)", (status) => {
    const { actions } = organisationStatePolicy(status, NONE);
    expect(actions.choose_unsold).toBe(actions.submit);
  });

  it("refuses a restricted organisation with a message that says how to decide", () => {
    expect(organisationUnsoldChoiceRefusal("restricted")).toEqual({
      code: "organisation_unsold_choice_paused",
      message:
        "Choices for works that did not sell are paused for this organisation. Contact us to decide what happens to them.",
    });
    expect(organisationUnsoldChoiceRefusal("approved")).toBeNull();
  });
});

describe("who can act on a banner", () => {
  it("names the roles that receive the banner as something to do", () => {
    expect(organisationBannerActors("documents_requested")).toEqual(["owner", "admin"]);
    expect(organisationBannerActors("payouts_not_set_up")).toEqual(["owner", "admin", "finance"]);
  });

  it("names nobody where only LAX can act", () => {
    for (const key of [
      "documents_under_review",
      "restricted",
      "not_approved",
      "archived",
    ] as const) {
      expect(organisationBannerActors(key)).toEqual([]);
    }
  });

  it("agrees with the audience: each actor is asked, everyone else is told", () => {
    for (const role of legalEntityMemberRoles) {
      const asked = organisationStatePolicy("docs_requested", forRole(role)).banner?.audience;
      expect(asked === "act").toBe(organisationBannerActors("documents_requested").includes(role));
    }
  });
});

describe("inviting people", () => {
  it.each(legalEntityStatuses)("refuses exactly when %s does not allow inviting", (status) => {
    const refusal = organisationInviteRefusal(status);
    expect(refusal === null).toBe(ALLOWED[status].includes("invite"));
  });

  it("gives a restricted organisation its own reason and a closed one the closed reason", () => {
    expect(organisationInviteRefusal("restricted")).toBe(ORGANISATION_RESTRICTED_MEMBERS);
    expect(organisationInviteRefusal("rejected")).toBe(ORGANISATION_CLOSED_TO_MEMBERS);
    expect(organisationInviteRefusal("archived")).toBe(ORGANISATION_CLOSED_TO_MEMBERS);
  });
});
