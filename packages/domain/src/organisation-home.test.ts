import type { LegalEntityMemberRole } from "@auction/types";
import { describe, expect, it } from "vitest";
import { computeConsignmentChecklist } from "./consignment-checklist.js";
import {
  type HomeActivityEvent,
  type OrganisationHomeFacts,
  buildOrganisationHome,
  homeShortcuts,
  homeTaskKindsFor,
} from "./organisation-home.js";

const agreementToAccept = computeConsignmentChecklist({
  submissionStatus: "approved",
  accountKind: "organisation",
  identity: "verified",
  agreement: { proposed: true, accepted: false },
  payoutsReady: false,
  viewer: { canAcceptAgreement: true, canSetUpPayouts: true },
  saleStartsAt: null,
});

/** An organisation with something for every role to do. */
function busy(role: LegalEntityMemberRole): OrganisationHomeFacts {
  return {
    actor: { role },
    organisation: { status: "approved", payoutsReady: false },
    consignments: [{ id: "c1", title: "Untitled (Blue)", checklist: agreementToAccept }],
    changesRequested: [{ id: "s1", title: "Study in Ochre", note: "Add a photo" }],
    unsoldLots: [{ id: "l1", title: "Harbour at Dusk" }],
    purchasesAwaitingPayment: [{ id: "p1", title: "Lot 14" }],
    viewerIdentity: "required",
    salesToRegister: [
      { id: "sale1", title: "Contemporary", startsAt: new Date("2026-11-04"), bidLimit: "10000" },
    ],
    hasWorkAwaitingPayout: true,
  };
}

/** An approved organisation with nothing left to do. */
function quiet(role: LegalEntityMemberRole): OrganisationHomeFacts {
  return {
    actor: { role },
    organisation: { status: "approved", payoutsReady: true },
    consignments: [],
    changesRequested: [],
    unsoldLots: [],
    purchasesAwaitingPayment: [],
    viewerIdentity: "verified",
    salesToRegister: [],
    hasWorkAwaitingPayout: false,
  };
}

const ACTIVITY: HomeActivityEvent[] = [
  { kind: "submission_sent", at: new Date("2026-10-01"), subject: { id: "a", title: "A" } },
  { kind: "lot_sold", at: new Date("2026-10-02"), subject: { id: "b", title: "B" } },
  { kind: "member_joined", at: new Date("2026-10-03"), subject: { id: "c", title: "Priya" } },
  {
    kind: "member_bids_stopped",
    at: new Date("2026-10-02T12:00:00Z"),
    subject: { id: "sam", title: "Sam Lee" },
    count: 2,
  },
  { kind: "purchase_won", at: new Date("2026-10-04"), subject: { id: "d", title: "D" } },
  { kind: "payout_sent", at: new Date("2026-10-05"), subject: { id: "e", title: "E" } },
  { kind: "changes_requested", at: new Date("2026-10-06"), subject: { id: "f", title: "F" } },
  { kind: "lot_unsold", at: new Date("2026-10-07"), subject: { id: "g", title: "G" } },
];

function taskKinds(facts: OrganisationHomeFacts) {
  return buildOrganisationHome(facts, ACTIVITY).tasks?.map((task) => task.kind) ?? null;
}

describe("buildOrganisationHome, per role", () => {
  it("owner: everything that keeps the organisation selling and buying", () => {
    expect(taskKinds(busy("owner"))).toEqual(["agreement", "changes", "payouts", "unsold", "pay"]);
    expect(homeShortcuts({ role: "owner" })).toEqual(["sell", "invite", "statements"]);
  });

  it("admin: the same tasks as the owner", () => {
    expect(taskKinds(busy("admin"))).toEqual(taskKinds(busy("owner")));
    expect(homeShortcuts({ role: "admin" })).toEqual(["sell", "invite", "statements"]);
  });

  it("finance: payouts and purchases to pay", () => {
    expect(taskKinds(busy("finance"))).toEqual(["payouts", "pay"]);
    expect(homeShortcuts({ role: "finance" })).toEqual(["statements", "purchases_to_pay"]);
  });

  it("consignor: their identity, submissions sent back and unsold lots; never the agreement", () => {
    expect(taskKinds(busy("consignor"))).toEqual(["identity", "changes", "unsold"]);
    expect(homeShortcuts({ role: "consignor" })).toEqual(["sell", "consignments"]);
  });

  it("buyer agent: identity, sales to register in, and wins finance has to pay", () => {
    expect(taskKinds(busy("buyer_agent"))).toEqual([
      "identity",
      "won_awaiting_payment",
      "register",
    ]);
    expect(homeShortcuts({ role: "buyer_agent" })).toEqual(["upcoming_sales", "bids"]);
  });

  it("viewer: no Needs you section at all, and read-only shortcuts", () => {
    expect(taskKinds(busy("viewer"))).toBeNull();
    expect(homeTaskKindsFor({ role: "viewer" })).toEqual([]);
    expect(homeShortcuts({ role: "viewer" })).toEqual(["consignments", "works"]);
  });

  it.each(["owner", "admin", "finance", "consignor", "buyer_agent"] as const)(
    "%s: an empty Needs you when nothing is left",
    (role) => {
      expect(taskKinds(quiet(role))).toEqual([]);
    },
  );

  it("gives every role two to four shortcuts", () => {
    for (const role of [
      "owner",
      "admin",
      "finance",
      "consignor",
      "buyer_agent",
      "viewer",
    ] as const) {
      const count = homeShortcuts({ role }).length;
      expect(count).toBeGreaterThanOrEqual(2);
      expect(count).toBeLessThanOrEqual(4);
    }
  });

  it("an impersonating platform admin is read-only: no tasks and no write shortcuts", () => {
    const actor = { role: "owner" as const, isImpersonation: true };
    expect(homeShortcuts(actor)).toEqual(["statements"]);
    expect(taskKinds({ ...busy("owner"), actor })).toBeNull();
  });
});

describe("setup state on Home", () => {
  it("asks owners for documents while they are requested", () => {
    const facts = {
      ...quiet("owner"),
      organisation: { status: "docs_requested" as const, payoutsReady: false },
    };
    const home = buildOrganisationHome(facts, []);
    expect(home.setup).toBe("documents_requested");
    expect(home.tasks?.map((t) => t.kind)).toEqual(["documents"]);
  });

  it("says documents are under review, with nothing to do", () => {
    const facts = {
      ...quiet("admin"),
      organisation: { status: "under_review" as const, payoutsReady: false },
    };
    const home = buildOrganisationHome(facts, []);
    expect(home.setup).toBe("documents_under_review");
    expect(home.tasks).toEqual([]);
  });

  it("says payouts are not set up once approved without them", () => {
    const facts = {
      ...quiet("consignor"),
      organisation: { status: "approved" as const, payoutsReady: false },
    };
    expect(buildOrganisationHome(facts, []).setup).toBe("payouts_not_set_up");
  });

  it("does not tell a buyer agent about payouts", () => {
    const organisation = { status: "approved" as const, payoutsReady: false };
    expect(buildOrganisationHome({ ...quiet("buyer_agent"), organisation }, []).setup).toBeNull();
    expect(buildOrganisationHome({ ...quiet("viewer"), organisation }, []).setup).toBe(
      "payouts_not_set_up",
    );
  });

  it("tells every role that documents are under review", () => {
    const organisation = { status: "under_review" as const, payoutsReady: false };
    expect(buildOrganisationHome({ ...quiet("buyer_agent"), organisation }, []).setup).toBe(
      "documents_under_review",
    );
  });

  it("shows no setup line once everything is done", () => {
    expect(buildOrganisationHome(quiet("owner"), []).setup).toBeNull();
  });
});

describe("recent activity", () => {
  const kinds = (role: LegalEntityMemberRole) =>
    buildOrganisationHome(quiet(role), ACTIVITY).activity.map((event) => event.kind);

  it("shows the five newest lines the role may see, newest first", () => {
    expect(kinds("owner")).toEqual([
      "lot_unsold",
      "changes_requested",
      "payout_sent",
      "purchase_won",
      "member_joined",
    ]);
  });

  it("keeps members and money to the roles that see them", () => {
    expect(kinds("consignor")).toEqual([
      "lot_unsold",
      "changes_requested",
      "lot_sold",
      "submission_sent",
    ]);
    expect(kinds("buyer_agent")).toEqual(["purchase_won"]);
  });

  it("tells owners and admins whose automatic bids stopped when they left", () => {
    const admin = buildOrganisationHome(quiet("admin"), ACTIVITY).activity;
    expect(admin.find((e) => e.kind === "member_bids_stopped")).toBeUndefined();
    const recent = buildOrganisationHome(
      quiet("admin"),
      ACTIVITY.filter((e) => e.kind === "member_bids_stopped"),
    ).activity;
    expect(recent).toEqual([expect.objectContaining({ kind: "member_bids_stopped", count: 2 })]);
    expect(kinds("finance")).not.toContain("member_bids_stopped");
  });

  it("leads See all to the role's main list", () => {
    expect(buildOrganisationHome(quiet("owner"), []).activityArchive).toBe("consignments");
    expect(buildOrganisationHome(quiet("buyer_agent"), []).activityArchive).toBe("bids");
  });
});
