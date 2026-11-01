import { legalEntityMemberRoles } from "@auction/types";
import type { LegalEntityMemberRole } from "@auction/types";
import { describe, expect, it } from "vitest";
import { type EntityCapability, entityActorCan, entityRoleCan } from "./entity-capabilities.js";

/** The full matrix, written out so a change to any cell is a visible test change. */
const EXPECTED: Record<EntityCapability, LegalEntityMemberRole[]> = {
  "entity.members.read": ["owner", "admin"],
  "entity.members.manage": ["owner", "admin"],
  "entity.ownership.manage": ["owner"],
  "entity.profile.read": ["owner", "admin"],
  "entity.documents.manage": ["owner", "admin"],
  "entity.security.read": ["owner", "admin"],
  "entity.security.manage": ["owner"],
  "entity.finance.read": ["owner", "admin", "finance"],
  "entity.finance.write": ["owner", "admin", "finance"],
  "entity.payouts.read": ["owner", "admin", "finance"],
  "entity.connect.manage": ["owner", "admin"],
  "entity.connect.operate": ["owner", "admin", "finance"],
  "entity.consignments.read": ["owner", "admin", "finance", "consignor", "viewer"],
  "entity.submissions.create": ["owner", "admin", "consignor"],
  "entity.submissions.manage": ["owner", "admin"],
  "entity.consignments.accept_agreement": ["owner", "admin"],
  "entity.consignments.withdraw": ["owner", "admin"],
  "entity.consignments.after_sale": ["owner", "admin"],
  "entity.bid.place": ["owner", "admin", "buyer_agent"],
  "entity.bid.place_without_authorisation": ["owner", "admin"],
  "entity.buyer_agents.read": ["owner", "admin"],
  "entity.buyer_agents.manage": ["owner", "admin"],
  "entity.bidding_limits.manage": ["owner", "admin"],
  "entity.holdings.read": ["owner", "admin", "finance", "viewer", "buyer_agent"],
  "entity.invoice_details.manage": ["owner", "admin", "finance"],
  "entity.activity.read": ["owner", "admin"],
  "entity.security.remind": ["owner", "admin"],
};

const capabilities = Object.keys(EXPECTED) as EntityCapability[];

describe("entityRoleCan", () => {
  it.each(legalEntityMemberRoles)("grants %s exactly the capabilities in the matrix", (role) => {
    const granted = capabilities.filter((capability) => entityRoleCan(role, capability));
    const expected = capabilities.filter((capability) => EXPECTED[capability].includes(role));
    expect(granted).toEqual(expected);
  });

  it("lets owner, admin and finance see money but not viewer, consignor or buyer_agent", () => {
    for (const role of ["owner", "admin", "finance"] as const) {
      expect(entityRoleCan(role, "entity.finance.read")).toBe(true);
      expect(entityRoleCan(role, "entity.payouts.read")).toBe(true);
    }
    for (const role of ["viewer", "consignor", "buyer_agent", "specialist", "staff"] as const) {
      expect(entityRoleCan(role, "entity.finance.read")).toBe(false);
      expect(entityRoleCan(role, "entity.payouts.read")).toBe(false);
    }
  });

  it("shows a consignor consignments but no holdings or money", () => {
    expect(entityRoleCan("consignor", "entity.consignments.read")).toBe(true);
    expect(entityRoleCan("consignor", "entity.holdings.read")).toBe(false);
    expect(entityRoleCan("consignor", "entity.finance.read")).toBe(false);
  });

  it("shows a viewer works but no money", () => {
    expect(entityRoleCan("viewer", "entity.holdings.read")).toBe(true);
    expect(entityRoleCan("viewer", "entity.consignments.read")).toBe(true);
    expect(entityRoleCan("viewer", "entity.finance.read")).toBe(false);
    expect(entityRoleCan("viewer", "entity.payouts.read")).toBe(false);
  });

  it("gives specialist and staff members nothing about the organisation", () => {
    for (const role of ["specialist", "staff"] as const) {
      expect(capabilities.filter((capability) => entityRoleCan(role, capability))).toEqual([]);
    }
  });

  it("keeps two-step verification policy changes to the owner", () => {
    expect(entityRoleCan("owner", "entity.security.manage")).toBe(true);
    expect(entityRoleCan("admin", "entity.security.manage")).toBe(false);
  });
});

describe("entityActorCan", () => {
  it("matches the role matrix for a real member", () => {
    for (const role of legalEntityMemberRoles) {
      for (const capability of capabilities) {
        expect(entityActorCan({ role, isImpersonation: false }, capability)).toBe(
          entityRoleCan(role, capability),
        );
      }
    }
  });

  it("lets an impersonating admin read the organisation's data", () => {
    const actor = { role: "admin", isImpersonation: true } as const;
    expect(entityActorCan(actor, "entity.finance.read")).toBe(true);
    expect(entityActorCan(actor, "entity.payouts.read")).toBe(true);
    expect(entityActorCan(actor, "entity.holdings.read")).toBe(true);
  });

  it("never lets an impersonating admin write", () => {
    const actor = { role: "admin", isImpersonation: true } as const;
    for (const capability of [
      "entity.finance.write",
      "entity.members.manage",
      "entity.connect.manage",
    ] as const) {
      expect(entityActorCan(actor, capability)).toBe(false);
    }
  });

  it("never lets an impersonating admin read or edit two-step verification", () => {
    for (const role of legalEntityMemberRoles) {
      const actor = { role, isImpersonation: true };
      expect(entityActorCan(actor, "entity.security.read")).toBe(false);
      expect(entityActorCan(actor, "entity.security.manage")).toBe(false);
    }
  });
});

describe("starting a submission", () => {
  it.each(["owner", "admin", "consignor"] as const)("allows %s", (role) => {
    expect(entityRoleCan(role, "entity.submissions.create")).toBe(true);
  });

  it.each(["finance", "viewer", "buyer_agent", "specialist", "staff"] as const)(
    "refuses %s",
    (role) => {
      expect(entityRoleCan(role, "entity.submissions.create")).toBe(false);
    },
  );

  it("is a write, so an impersonating admin cannot start one", () => {
    expect(
      entityActorCan({ role: "owner", isImpersonation: true }, "entity.submissions.create"),
    ).toBe(false);
  });
});

describe("bidding for an organisation", () => {
  it.each(["owner", "admin", "buyer_agent"] as const)("allows %s", (role) => {
    expect(entityRoleCan(role, "entity.bid.place")).toBe(true);
  });

  it.each(["finance", "consignor", "viewer", "specialist", "staff"] as const)(
    "refuses %s",
    (role) => {
      expect(entityRoleCan(role, "entity.bid.place")).toBe(false);
    },
  );

  it("needs an authorisation only for buyer agents", () => {
    expect(entityRoleCan("buyer_agent", "entity.bid.place_without_authorisation")).toBe(false);
    expect(entityRoleCan("owner", "entity.bid.place_without_authorisation")).toBe(true);
    expect(entityRoleCan("admin", "entity.bid.place_without_authorisation")).toBe(true);
  });

  it("lets only owners and admins manage buyer agents", () => {
    for (const role of legalEntityMemberRoles) {
      expect(entityRoleCan(role, "entity.buyer_agents.manage")).toBe(
        role === "owner" || role === "admin",
      );
    }
  });

  it("is a write, so an impersonating admin can neither bid nor authorise", () => {
    const actor = { role: "owner", isImpersonation: true } as const;
    expect(entityActorCan(actor, "entity.bid.place")).toBe(false);
    expect(entityActorCan(actor, "entity.buyer_agents.manage")).toBe(false);
  });
});
