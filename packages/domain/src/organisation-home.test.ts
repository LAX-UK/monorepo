import type { LegalEntityMemberRole } from "@auction/types";
import { describe, expect, it } from "vitest";
import { emptyConsignmentProgress } from "./consignment-progress.js";
import { type NeedsYouTask, needsYouKindsFor } from "./needs-you.js";
import type { DashboardFigures } from "./organisation-dashboard.js";
import {
  type HomeActivityEvent,
  type NeedsYouRead,
  type OrganisationHomeFacts,
  buildOrganisationHome,
  homeNotices,
  homeShortcuts,
  organisationFirstSteps,
} from "./organisation-home.js";

/** An approved organisation with nothing left to do. */
function quiet(role: LegalEntityMemberRole): OrganisationHomeFacts {
  return {
    actor: { role },
    organisation: { status: "approved", payoutsReady: true },
    unsoldLots: [],
    teamInvited: true,
  };
}

/** What the reader says for a role: its kinds, and these tasks. */
function read(role: LegalEntityMemberRole, tasks: NeedsYouTask[] = []): NeedsYouRead {
  return { kinds: needsYouKindsFor({ role }), tasks };
}

/** Nothing to count yet: a new organisation. */
const NOTHING_YET: DashboardFigures = {
  soldThisYear: { year: 2026, works: 0, totals: [] },
  payoutsDue: { payouts: 0, totals: [], nextDate: null, overdueSince: null },
  upcomingSales: [],
  consignmentProgress: emptyConsignmentProgress(),
  openBids: { lots: 0, totalMax: [] },
};

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

const OUTBID: NeedsYouTask = {
  kind: "outbid",
  lots: [{ id: "l88", title: "Sun over Arles", endsAt: new Date("2026-10-30T18:12:00Z") }],
};
const PAY: NeedsYouTask = { kind: "pay", purchases: [{ id: "p1", title: "Harbour at dawn" }] };

describe("Needs you on Home comes from the one reader", () => {
  it("shows the reader's tasks in the reader's order, adding and dropping none", () => {
    const home = buildOrganisationHome(quiet("owner"), [], null, read("owner", [OUTBID, PAY]));
    expect(home.tasks).toEqual([OUTBID, PAY]);
    expect(home.needsYouFailed).toBe(false);
  });

  it("hides the section for a role that can never be asked for anything", () => {
    const home = buildOrganisationHome(quiet("viewer"), [], null, { kinds: [], tasks: [] });
    expect(home.tasks).toBeNull();
  });

  it("an empty list when the role has kinds but nothing waits", () => {
    expect(buildOrganisationHome(quiet("finance"), [], null, read("finance")).tasks).toEqual([]);
  });

  it("says the reader failed rather than that nothing needs you", () => {
    const home = buildOrganisationHome(quiet("owner"), [], null, null);
    expect(home.tasks).toBeNull();
    expect(home.needsYouFailed).toBe(true);
  });
});

describe("first steps", () => {
  const newOrganisation = (
    status: OrganisationHomeFacts["organisation"]["status"],
    payoutsReady = false,
  ): OrganisationHomeFacts => ({
    ...quiet("owner"),
    organisation: { status, payoutsReady },
    teamInvited: false,
  });

  it("documents first, then payouts, then the team", () => {
    const steps = organisationFirstSteps(
      newOrganisation("docs_requested"),
      read("owner", [{ kind: "documents" }]),
    );
    expect(steps).toEqual([
      { id: "documents", state: "next" },
      { id: "payouts", state: "later" },
      { id: "invite", state: "later" },
    ]);
  });

  it("documents being checked are with LAX, not with the member", () => {
    const steps = organisationFirstSteps(newOrganisation("under_review"), read("owner"));
    expect(steps?.[0]).toEqual({ id: "documents", state: "waiting" });
  });

  it("payouts is the step the reader asks for, and the task is not listed twice", () => {
    const facts = newOrganisation("approved");
    const home = buildOrganisationHome(
      facts,
      [],
      NOTHING_YET,
      read("owner", [PAY, { kind: "payouts" }]),
    );
    expect(home.firstSteps).toEqual([
      { id: "documents", state: "done" },
      { id: "payouts", state: "next" },
      { id: "invite", state: "later" },
    ]);
    expect(home.tasks).toEqual([PAY]);
  });

  it("the team step is next once setup is done, while there is nothing yet", () => {
    const home = buildOrganisationHome(
      newOrganisation("approved", true),
      [],
      NOTHING_YET,
      read("owner"),
    );
    expect(home.firstSteps?.at(-1)).toEqual({ id: "invite", state: "next" });
  });

  it("never nags a working organisation to invite anyone", () => {
    const busy: DashboardFigures = {
      ...NOTHING_YET,
      openBids: { lots: 2, totalMax: [{ amount: "4000", currency: "GBP" }] },
    };
    const home = buildOrganisationHome(newOrganisation("approved", true), [], busy, read("owner"));
    expect(home.firstSteps).toBeNull();
  });

  it("keeps the steps for the people who run the organisation", () => {
    for (const role of ["finance", "consignor", "buyer_agent", "viewer"] as const) {
      expect(
        organisationFirstSteps({ ...newOrganisation("approved"), actor: { role } }, read(role)),
      ).toBeNull();
    }
  });

  it("is gone once every step is done", () => {
    const home = buildOrganisationHome(quiet("owner"), [], NOTHING_YET, read("owner"));
    expect(home.firstSteps).toBeNull();
  });
});

describe("shortcuts", () => {
  it("keeps shortcuts for the people who run the organisation; other roles use the figures", () => {
    const withShortcuts = (
      ["owner", "admin", "finance", "consignor", "buyer_agent", "viewer"] as const
    ).filter((role) => homeShortcuts({ role }, "approved").length > 0);
    expect(withShortcuts).toEqual(["owner", "admin"]);
    expect(homeShortcuts({ role: "owner" }, "approved")).toEqual(["sell", "invite", "statements"]);
  });

  it("an impersonating platform admin gets no write shortcuts", () => {
    expect(homeShortcuts({ role: "owner", isImpersonation: true }, "approved")).toEqual([
      "statements",
    ]);
  });

  it("offers a restricted organisation only its statements", () => {
    expect(homeShortcuts({ role: "owner" }, "restricted")).toEqual(["statements"]);
  });

  it("keeps Sell a work away from an organisation that is not approved yet", () => {
    for (const status of ["lead", "docs_requested", "under_review", "connect_pending"] as const) {
      expect(homeShortcuts({ role: "owner" }, status)).not.toContain("sell");
    }
  });
});

describe("organisation state on Home", () => {
  const banner = (facts: OrganisationHomeFacts) =>
    buildOrganisationHome(facts, [], null, read(facts.actor.role)).state.banner;

  it("asks owners for documents while they are requested", () => {
    const facts = {
      ...quiet("owner"),
      organisation: { status: "docs_requested" as const, payoutsReady: false },
    };
    expect(banner(facts)).toEqual({
      kind: "attention",
      key: "documents_requested",
      audience: "act",
    });
  });

  it("tells a consignor documents are requested without asking them to send them", () => {
    const facts = {
      ...quiet("consignor"),
      organisation: { status: "docs_requested" as const, payoutsReady: false },
    };
    expect(banner(facts)).toMatchObject({ key: "documents_requested", audience: "told" });
  });

  it("says payouts are not set up to those who act and those who are told", () => {
    const facts = {
      ...quiet("consignor"),
      organisation: { status: "approved" as const, payoutsReady: false },
    };
    expect(banner(facts)).toMatchObject({ key: "payouts_not_set_up", audience: "told" });
    expect(banner({ ...facts, actor: { role: "finance" } })).toMatchObject({ audience: "act" });
    expect(banner({ ...facts, actor: { role: "buyer_agent" } })).toBeNull();
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
    const home = buildOrganisationHome(facts, [], NOTHING_YET, read("owner"));
    expect(home.dashboard?.firstRun?.actions).toEqual([]);
    expect(home.state.homeFirstRunKey).toBe("restricted");
  });

  it("shows no banner once everything is done", () => {
    expect(banner(quiet("owner"))).toBeNull();
  });
});

describe("recent activity", () => {
  const kinds = (role: LegalEntityMemberRole) =>
    buildOrganisationHome(quiet(role), ACTIVITY, null, read(role)).activity.map(
      (event) => event.kind,
    );

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
    const recent = buildOrganisationHome(
      quiet("admin"),
      ACTIVITY.filter((e) => e.kind === "member_bids_stopped"),
      null,
      read("admin"),
    ).activity;
    expect(recent).toEqual([expect.objectContaining({ kind: "member_bids_stopped", count: 2 })]);
    expect(kinds("finance")).not.toContain("member_bids_stopped");
  });

  it("leads See all to the role's main list", () => {
    const archive = (role: LegalEntityMemberRole) =>
      buildOrganisationHome(quiet(role), [], null, read(role)).activityArchive;
    expect(archive("owner")).toBe("consignments");
    expect(archive("buyer_agent")).toBe("bids");
  });
});

describe("unsold works as information", () => {
  const ended = (choice: "none" | "requested" | "confirmed") => ({
    id: "l1",
    title: "Harbour at Dusk",
    choice,
  });
  const facts = (role: LegalEntityMemberRole, lots: OrganisationHomeFacts["unsoldLots"]) => ({
    ...quiet(role),
    unsoldLots: lots,
  });

  it("tells a consignor a lot is waiting, as information and not a task", () => {
    expect(homeNotices(facts("consignor", [ended("none")]))).toEqual([
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

  const paused = (role: LegalEntityMemberRole) => ({
    ...quiet(role),
    organisation: { status: "restricted" as const, payoutsReady: true },
    unsoldLots: [
      { id: "l1", title: "Harbour at Dusk", choice: "none" as const },
      { id: "l2", title: "Study in Ochre", choice: "none" as const },
    ],
  });

  it.each(["owner", "admin"] as const)(
    "tells a %s of a restricted organisation to contact us about unsold works",
    (role) => {
      expect(homeNotices(paused(role))).toEqual([
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
});
