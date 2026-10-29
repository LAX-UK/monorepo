import {
  type HomeTask,
  type OrganisationHomeModel,
  organisationStatePolicy,
} from "@auction/domain";
import { describe, expect, it } from "vitest";
import { roleExplanation, welcomeHeadline } from "./member-role-copy";
import { homeActivityEvents } from "./organisation-home-activity";
import {
  buyerAgentAuthorityLine,
  homeTaskView,
  organisationHomeView,
} from "./organisation-home-view";

const ctx = { organisationName: "Northbank Gallery" };

const EVERY_TASK: HomeTask[] = [
  { kind: "documents" },
  { kind: "identity" },
  { kind: "agreement", consignment: { id: "c1", title: "Untitled (Blue)" } },
  { kind: "changes", submission: { id: "s1", title: "Study in Ochre" }, note: "Add a photo" },
  { kind: "payouts" },
  { kind: "unsold", lots: [{ id: "l1", title: "Harbour at Dusk" }] },
  { kind: "pay", purchases: [{ id: "p1", title: "Lot 14" }] },
  { kind: "won_awaiting_payment", purchases: [{ id: "p1", title: "Lot 14" }] },
  {
    kind: "register",
    sale: { id: "sale1", title: "Contemporary" },
    startsAt: new Date("2026-11-04T18:00:00Z"),
    bidLimit: "10000.00",
  },
];

describe("homeTaskView", () => {
  it("gives every task a title, a detail and exactly one button", () => {
    for (const task of EVERY_TASK) {
      const view = homeTaskView(task, ctx);
      expect(view.title.length).toBeGreaterThan(0);
      expect(view.detail.length).toBeGreaterThan(0);
      expect(view.action.label.length).toBeGreaterThan(0);
      expect(view.action.href.startsWith("/")).toBe(true);
    }
  });

  it("leads each task to the place it is done", () => {
    const hrefs = Object.fromEntries(
      EVERY_TASK.map((task) => [task.kind, homeTaskView(task, ctx).action.href]),
    );
    expect(hrefs).toMatchObject({
      agreement: "/selling/consignments/c1#agreement",
      changes: "/selling/consignments/s1",
      payouts: "/organisation/payouts",
      identity: "/verify-identity",
      register: "/sales/contemporary/sale1",
    });
  });

  it("shows the buyer agent's limit on the sale to register for", () => {
    const register = EVERY_TASK.find((t) => t.kind === "register") as HomeTask;
    expect(homeTaskView(register, ctx).detail).toBe("You're authorised to bid up to £10,000.00");
  });
});

describe("organisationHomeView", () => {
  const model: OrganisationHomeModel = {
    tasks: [],
    setup: "documents_under_review",
    state: organisationStatePolicy("under_review", new Set()),
    notices: [],
    shortcuts: ["sell", "invite", "statements"],
    activity: [],
    activityArchive: "consignments",
    dashboard: null,
  };

  it("keeps an empty Needs you, and hides it for roles with nothing to do", () => {
    expect(organisationHomeView(model, ctx).needsYou).toEqual([]);
    expect(organisationHomeView({ ...model, tasks: null }, ctx).needsYou).toBeNull();
  });

  it("says documents are under review with the usual wait", () => {
    expect(organisationHomeView(model, ctx).setup).toMatchObject({
      tone: "info",
      title: "Documents under review.",
    });
    expect(organisationHomeView(model, ctx).setup?.detail).toContain("2–3 working days");
  });

  it("labels shortcuts and See all", () => {
    const view = organisationHomeView(model, ctx);
    expect(view.shortcuts.map((s) => s.label)).toEqual([
      "Sell a work",
      "Invite someone",
      "Statements",
    ]);
    expect(view.seeAllHref).toBe("/selling/consignments");
  });
});

describe("buyerAgentAuthorityLine", () => {
  it("states the limit of an all-sales authorisation, and nothing for sale-by-sale ones", () => {
    expect(buyerAgentAuthorityLine([{ sale: null, bidLimit: "10000.00", validUntil: null }])).toBe(
      "You may bid for the organisation in every sale, up to £10,000.00.",
    );
    expect(
      buyerAgentAuthorityLine([
        {
          sale: {
            id: "s",
            title: "Contemporary",
            startTime: "2026-11-04T18:00:00Z",
            registered: true,
          },
          bidLimit: null,
          validUntil: null,
        },
      ]),
    ).toBeNull();
  });
});

describe("stopped bids activity", () => {
  it("names who left and how many lots, linking to the details", () => {
    const view = organisationHomeView(
      {
        tasks: [],
        setup: null,
        state: organisationStatePolicy("approved", new Set()),
        notices: [],
        shortcuts: [],
        activity: [
          {
            kind: "member_bids_stopped",
            at: new Date("2026-10-28T09:00:00Z"),
            subject: { id: "sam", title: "Sam Lee" },
            count: 2,
          },
        ],
        activityArchive: null,
        dashboard: null,
      },
      ctx,
    );
    expect(view.activity[0]).toMatchObject({
      text: "Sam Lee's automatic bids stopped when they left: 2 lots",
      href: "/organisation/members#stopped-member-bids",
    });
  });
});

describe("member role copy", () => {
  it("explains a role in one paragraph from its abilities", () => {
    expect(roleExplanation("consignor", "Northbank Gallery")).toBe(
      "As a Consignor at Northbank Gallery, you can send works to sell for the organisation and follow their progress. Anything else is done by its owners and admins. Your own bids, purchases and sales stay in your personal account; switch between them from the account menu.",
    );
  });

  it("reads naturally for every role", () => {
    expect(welcomeHeadline("admin", "Northbank Gallery")).toBe(
      "You're now an Admin at Northbank Gallery.",
    );
    expect(welcomeHeadline("finance", "Northbank Gallery")).toBe(
      "You're now a Finance member at Northbank Gallery.",
    );
    expect(roleExplanation("owner", "Northbank Gallery")).not.toContain("owners and admins");
  });
});

describe("homeActivityEvents", () => {
  it("turns submissions, lots, purchases and new members into activity", () => {
    const events = homeActivityEvents({
      submissions: [
        {
          id: "s1",
          title: "Study in Ochre",
          status: "changes_requested",
          createdAt: new Date("2026-10-01"),
          reviewedAt: null,
          changesRequestedAt: new Date("2026-10-03"),
        },
        {
          id: "s2",
          title: "Draft",
          status: "draft",
          createdAt: new Date("2026-10-02"),
          reviewedAt: null,
          changesRequestedAt: null,
        },
      ],
      lots: [
        {
          id: "l1",
          title: "Harbour at Dusk",
          status: "ended",
          winnerId: null,
          endTime: new Date("2026-10-21"),
        },
        { id: "l2", title: "Live", status: "active", winnerId: null, endTime: new Date() },
      ],
      purchases: [],
      members: [
        { id: "m1", name: "Priya Shah", acceptedAt: new Date("2026-10-05"), invited: true },
        { id: "m2", name: "Founder", acceptedAt: new Date("2026-01-01"), invited: false },
      ],
      stoppedMemberBids: [
        { memberUserId: "sam", memberName: "Sam Lee", stoppedAt: new Date("2026-10-06"), count: 2 },
      ],
    });
    expect(events.map((e) => `${e.kind}:${e.subject.id}`)).toEqual([
      "submission_sent:s1",
      "changes_requested:s1",
      "lot_unsold:l1",
      "member_joined:m1",
      "member_bids_stopped:sam",
    ]);
  });
});
