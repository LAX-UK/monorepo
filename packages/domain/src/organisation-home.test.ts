import type { LegalEntityMemberRole } from "@auction/types";
import { describe, expect, it } from "vitest";
import { computeConsignmentChecklist } from "./consignment-checklist.js";
import { emptyConsignmentProgress } from "./consignment-progress.js";
import {
  type HomeActivityEvent,
  type OrganisationHomeFacts,
  buildOrganisationHome,
  homeNotices,
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
    unsoldLots: [{ id: "l1", title: "Harbour at Dusk", choice: "none" }],
    purchasesAwaitingPayment: [{ id: "p1", title: "Lot 14" }],
    viewerIdentity: "required",
    salesToRegister: [
      { id: "sale1", title: "Contemporary", startsAt: new Date("2026-11-04"), bidLimit: "10000" },
    ],
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
    // Money and time first, then binding steps, then the rest of the work, then setup.
    expect(taskKinds(busy("owner"))).toEqual(["pay", "agreement", "changes", "unsold", "payouts"]);
    expect(homeShortcuts({ role: "owner" }, "approved")).toEqual(["sell", "invite", "statements"]);
  });

  it("admin: the same tasks as the owner", () => {
    expect(taskKinds(busy("admin"))).toEqual(taskKinds(busy("owner")));
    expect(homeShortcuts({ role: "admin" }, "approved")).toEqual(["sell", "invite", "statements"]);
  });

  it("finance: payouts and purchases to pay", () => {
    expect(taskKinds(busy("finance"))).toEqual(["pay", "payouts"]);
    expect(homeShortcuts({ role: "finance" }, "approved")).toEqual([]);
  });

  it("consignor: their identity and submissions sent back; never the agreement or the unsold choice", () => {
    expect(taskKinds(busy("consignor"))).toEqual(["changes", "identity"]);
    expect(homeShortcuts({ role: "consignor" }, "approved")).toEqual([]);
  });

  it("buyer agent: identity, sales to register in, and wins finance has to pay", () => {
    expect(taskKinds(busy("buyer_agent"))).toEqual([
      "won_awaiting_payment",
      "register",
      "identity",
    ]);
    expect(homeShortcuts({ role: "buyer_agent" }, "approved")).toEqual([]);
  });

  it("viewer: no Needs you section at all", () => {
    expect(taskKinds(busy("viewer"))).toBeNull();
    expect(homeTaskKindsFor({ role: "viewer" })).toEqual([]);
    expect(homeShortcuts({ role: "viewer" }, "approved")).toEqual([]);
  });

  it.each(["owner", "admin", "finance", "consignor", "buyer_agent"] as const)(
    "%s: an empty Needs you when nothing is left",
    (role) => {
      expect(taskKinds(quiet(role))).toEqual([]);
    },
  );

  it("keeps shortcuts for the people who run the organisation; other roles use the figures", () => {
    const withShortcuts = (
      ["owner", "admin", "finance", "consignor", "buyer_agent", "viewer"] as const
    ).filter((role) => homeShortcuts({ role }, "approved").length > 0);
    expect(withShortcuts).toEqual(["owner", "admin"]);
  });

  it("an impersonating platform admin is read-only: no tasks and no write shortcuts", () => {
    const actor = { role: "owner" as const, isImpersonation: true };
    expect(homeShortcuts(actor, "approved")).toEqual(["statements"]);
    expect(taskKinds({ ...busy("owner"), actor })).toBeNull();
  });
});

describe("organisation state on Home", () => {
  const banner = (facts: OrganisationHomeFacts) => buildOrganisationHome(facts, []).state.banner;

  it("asks owners for documents while they are requested", () => {
    const facts = {
      ...quiet("owner"),
      organisation: { status: "docs_requested" as const, payoutsReady: false },
    };
    const home = buildOrganisationHome(facts, []);
    expect(home.state.banner).toEqual({
      kind: "attention",
      key: "documents_requested",
      audience: "act",
    });
    expect(home.tasks?.map((t) => t.kind)).toEqual(["documents"]);
  });

  it("tells a consignor documents are requested without asking them to send them", () => {
    const facts = {
      ...quiet("consignor"),
      organisation: { status: "docs_requested" as const, payoutsReady: false },
    };
    expect(banner(facts)).toMatchObject({ key: "documents_requested", audience: "told" });
  });

  it("says documents are under review, with nothing to do", () => {
    const facts = {
      ...quiet("admin"),
      organisation: { status: "under_review" as const, payoutsReady: false },
    };
    const home = buildOrganisationHome(facts, []);
    expect(home.state.banner).toMatchObject({ key: "documents_under_review", audience: "told" });
    expect(home.tasks).toEqual([]);
  });

  it("says payouts are not set up once approved without them", () => {
    const facts = {
      ...quiet("consignor"),
      organisation: { status: "approved" as const, payoutsReady: false },
    };
    expect(banner(facts)).toMatchObject({ key: "payouts_not_set_up", audience: "told" });
    expect(banner({ ...facts, actor: { role: "finance" } })).toMatchObject({ audience: "act" });
  });

  it("offers the payouts task exactly to those the banner asks to act, with or without work", () => {
    const organisation = { status: "approved" as const, payoutsReady: false };
    const tasksFor = (role: LegalEntityMemberRole) =>
      taskKinds({ ...quiet(role), organisation, actor: { role } }) ?? [];
    for (const role of ["owner", "admin", "finance"] as const) {
      expect(banner({ ...quiet(role), organisation })).toMatchObject({ audience: "act" });
      expect(tasksFor(role)).toContain("payouts");
    }
    for (const role of ["consignor", "viewer"] as const) {
      expect(banner({ ...quiet(role), organisation })).toMatchObject({ audience: "told" });
      expect(tasksFor(role)).not.toContain("payouts");
    }
    expect(tasksFor("buyer_agent")).not.toContain("payouts");
  });

  it("offers no payouts task once payouts are ready", () => {
    expect(taskKinds(quiet("owner"))).toEqual([]);
  });

  it("does not tell a buyer agent about payouts", () => {
    const organisation = { status: "approved" as const, payoutsReady: false };
    expect(banner({ ...quiet("buyer_agent"), organisation })).toBeNull();
    expect(banner({ ...quiet("viewer"), organisation })).toMatchObject({
      key: "payouts_not_set_up",
    });
  });

  it("tells every role, buyer agents included, that a restricted organisation is paused", () => {
    const organisation = { status: "restricted" as const, payoutsReady: true };
    for (const role of ["owner", "finance", "buyer_agent", "viewer"] as const) {
      expect(banner({ ...quiet(role), organisation })).toEqual({
        kind: "blocked",
        key: "restricted",
        audience: "told",
      });
    }
  });

  it("never offers a restricted organisation's owner a first work to sell", () => {
    const facts = {
      ...quiet("owner"),
      organisation: { status: "restricted" as const, payoutsReady: true },
    };
    const home = buildOrganisationHome(facts, [], {
      soldThisYear: { year: 2026, works: 0, totals: [] },
      payoutsDue: { payouts: 0, totals: [], nextDate: null, overdueSince: null },
      upcomingSales: [],
      consignmentProgress: emptyConsignmentProgress(),
      openBids: { lots: 0, totalMax: [] },
    });
    expect(home.dashboard?.firstRun?.actions).toEqual([]);
    expect(home.state.homeFirstRunKey).toBe("restricted");
  });

  it("shows no banner once everything is done", () => {
    expect(banner(quiet("owner"))).toBeNull();
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

describe("the unsold task", () => {
  const ended = (choice: "none" | "requested" | "confirmed") => ({
    id: "l1",
    title: "Harbour at Dusk",
    choice,
  });
  const facts = (role: LegalEntityMemberRole, lots: OrganisationHomeFacts["unsoldLots"]) => ({
    ...quiet(role),
    unsoldLots: lots,
  });

  it.each(["owner", "admin"] as const)("%s chooses for lots with no choice yet", (role) => {
    expect(taskKinds(facts(role, [ended("none")]))).toEqual(["unsold"]);
  });

  it.each(["owner", "admin"] as const)("%s has no task once a choice is made", (role) => {
    expect(taskKinds(facts(role, [ended("requested"), ended("confirmed")]))).toEqual([]);
  });

  it("lists only the lots nobody has chosen for", () => {
    const asked = { ...ended("requested"), id: "l2" };
    const tasks = buildOrganisationHome(facts("owner", [ended("none"), asked]), []).tasks;
    expect(tasks).toEqual([{ kind: "unsold", lots: [{ id: "l1", title: "Harbour at Dusk" }] }]);
  });

  it.each(["finance", "buyer_agent", "viewer"] as const)("%s is not asked to choose", (role) => {
    expect(taskKinds(facts(role, [ended("none")])) ?? []).not.toContain("unsold");
  });

  it("tells a consignor a lot is waiting, as information and not a task", () => {
    const home = buildOrganisationHome(facts("consignor", [ended("none")]), []);
    expect(home.tasks?.map((task) => task.kind)).not.toContain("unsold");
    expect(home.notices).toEqual([
      { kind: "unsold_waiting", lots: [{ id: "l1", title: "Harbour at Dusk" }] },
    ]);
  });

  it("gives the consignor nothing once a choice is made; only those who follow consignments but cannot choose get it", () => {
    expect(homeNotices(facts("consignor", [ended("requested")]))).toEqual([]);
    for (const role of ["owner", "admin", "finance", "buyer_agent", "viewer"] as const) {
      const informed = ["finance", "viewer"].includes(role);
      expect(homeNotices(facts(role, [ended("none")]))).toHaveLength(informed ? 1 : 0);
    }
  });
});

describe("unsold works while choices are paused", () => {
  const paused = (role: LegalEntityMemberRole) => ({
    ...quiet(role),
    organisation: { status: "restricted" as const, payoutsReady: true },
    unsoldLots: [
      { id: "l1", title: "Harbour at Dusk", choice: "none" as const },
      { id: "l2", title: "Study in Ochre", choice: "none" as const },
    ],
  });

  it.each(["owner", "admin"] as const)(
    "gives a %s of a restricted organisation no task, and a notice to contact us",
    (role) => {
      const home = buildOrganisationHome(paused(role), []);
      expect(home.tasks?.map((task) => task.kind)).not.toContain("unsold");
      expect(home.notices).toEqual([
        {
          kind: "unsold_paused",
          lots: [
            { id: "l1", title: "Harbour at Dusk" },
            { id: "l2", title: "Study in Ochre" },
          ],
        },
      ]);
    },
  );

  it.each(["consignor", "finance", "viewer"] as const)(
    "never tells a %s that an owner will choose while nobody can",
    (role) => {
      expect(homeNotices(paused(role))).toEqual([]);
    },
  );

  it.each(["under_review", "docs_requested", "connect_pending"] as const)(
    "pauses choices wherever submitting is closed (%s)",
    (status) => {
      const facts = { ...paused("owner"), organisation: { status, payoutsReady: false } };
      expect(buildOrganisationHome(facts, []).tasks?.map((t) => t.kind)).not.toContain("unsold");
    },
  );
});

describe("Home by organisation state", () => {
  const inState = (
    role: LegalEntityMemberRole,
    status: OrganisationHomeFacts["organisation"]["status"],
  ): OrganisationHomeFacts => ({
    ...busy(role),
    organisation: { status, payoutsReady: false },
  });

  it("offers no selling, agreements or registering to a restricted organisation", () => {
    expect(taskKinds(inState("owner", "restricted"))).toEqual(["pay"]);
    expect(taskKinds(inState("buyer_agent", "restricted"))).toEqual([
      "won_awaiting_payment",
      "identity",
    ]);
    expect(homeShortcuts({ role: "owner" }, "restricted")).toEqual(["statements"]);
  });

  it("keeps Sell a work away from an organisation that is not approved yet", () => {
    for (const status of ["lead", "docs_requested", "under_review", "connect_pending"] as const) {
      expect(homeShortcuts({ role: "owner" }, status)).not.toContain("sell");
    }
  });

  it("carries the state's banner and reasons for the member", () => {
    const owner = buildOrganisationHome(inState("owner", "restricted"), []);
    expect(owner.state.banner).toEqual({ kind: "blocked", key: "restricted", audience: "told" });
    expect(owner.state.homeFirstRunKey).toBe("restricted");
    const agent = buildOrganisationHome(inState("buyer_agent", "restricted"), []);
    expect(agent.state.bidPanelReasonKey).toBe("restricted");
  });
});
