import type { NeedsYouTaskWithLink } from "@/lib/workspace/needs-you-read";
import {
  type OrganisationHomeModel,
  entityCapabilitiesOf,
  organisationStatePolicy,
} from "@auction/domain";
import { describe, expect, it } from "vitest";
import { roleExplanation, welcomeHeadline } from "./member-role-copy";
import { homeActivityEvents } from "./organisation-home-activity";
import { buyerAgentAuthorityLine, organisationHomeView } from "./organisation-home-view";

const ctx = { organisationName: "Northbank Gallery", now: new Date("2026-10-30T09:00:00Z") };

describe("organisationHomeView", () => {
  const model: OrganisationHomeModel<NeedsYouTaskWithLink> = {
    tasks: [],
    needsYouFailed: false,
    firstSteps: null,
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

  it("says when the reader failed instead of saying nothing needs you", () => {
    const view = organisationHomeView({ ...model, tasks: null, needsYouFailed: true }, ctx);
    expect(view.needsYouFailed).toBe(true);
    expect(view.needsYou).toBeNull();
  });

  it("counts first steps done and gives the step to take now its one primary button", () => {
    const view = organisationHomeView(
      {
        ...model,
        firstSteps: [
          { id: "documents", state: "done" },
          { id: "payouts", state: "next" },
          { id: "invite", state: "later" },
        ],
      },
      ctx,
    );
    expect(view.firstSteps?.done).toBe(1);
    expect(view.firstSteps?.steps.map((step) => step.action)).toEqual([
      null,
      { label: "Set up payouts", href: "/organisation/payouts", primary: true },
      { label: "Invite a member", href: "/team", primary: false },
    ]);
  });

  it("says documents are under review as a quiet line, not a banner", () => {
    const view = organisationHomeView(model, ctx);
    expect(view.banner).toBeNull();
    expect(view.notices[0]).toMatchObject({ key: "state:documents_under_review" });
    expect(view.notices[0]?.text).toContain("2–3 working days");
  });

  it("keeps the blocking documents banner, and offers its action once: in Needs you", () => {
    const owner = entityCapabilitiesOf({ role: "owner" });
    const requested = { ...model, state: organisationStatePolicy("docs_requested", owner) };
    expect(organisationHomeView(requested, ctx).banner?.action?.label).toBe("Send documents");
    const withTask = organisationHomeView(
      {
        ...requested,
        tasks: [{ kind: "documents", link: { page: "organisation", view: "documents" } }],
      },
      ctx,
    );
    expect(withTask.banner).toMatchObject({ title: "Documents requested.", action: null });
    expect(withTask.needsYou?.[0]?.action.label).toBe("Open documents");
  });

  it("makes payouts not set up a task for those who act, and a line for everyone else", () => {
    const finance = entityCapabilitiesOf({ role: "finance" });
    const state = organisationStatePolicy("approved", finance, { payoutsReady: false });
    const asked = organisationHomeView(
      {
        ...model,
        state,
        tasks: [{ kind: "payouts", link: { page: "organisation", view: "payouts" } }],
      },
      ctx,
    );
    expect(asked.banner).toBeNull();
    expect(asked.notices).toEqual([]);
    const consignor = entityCapabilitiesOf({ role: "consignor" });
    const told = organisationHomeView(
      {
        ...model,
        state: organisationStatePolicy("approved", consignor, { payoutsReady: false }),
      },
      ctx,
    );
    expect(told.banner).toBeNull();
    expect(told.notices[0]?.key).toBe("state:payouts_not_set_up");
  });

  it("shows no banner when the state has nothing to tell", () => {
    const approved = { ...model, state: organisationStatePolicy("approved", new Set()) };
    expect(organisationHomeView(approved, ctx).banner).toBeNull();
  });

  it("tells the owner of a paused organisation to contact us about unsold works", () => {
    const view = organisationHomeView(
      {
        ...model,
        state: organisationStatePolicy("approved", new Set()),
        notices: [
          {
            kind: "unsold_paused",
            lots: [
              { id: "l1", title: "Harbour at Dusk" },
              { id: "l2", title: "Study in Ochre" },
            ],
          },
        ],
      },
      ctx,
    );
    expect(view.notices).toEqual([
      {
        key: "unsold_paused",
        text: "2 works did not sell.",
        href: null,
        action: expect.objectContaining({
          label: "Contact us to decide what happens to them",
          href: expect.stringMatching(/^mailto:/),
        }),
      },
    ]);
  });

  it("shows notices as quiet lines that name who chooses", () => {
    const one = organisationHomeView(
      {
        ...model,
        state: organisationStatePolicy("approved", new Set()),
        notices: [{ kind: "unsold_waiting", lots: [{ id: "l1", title: "Harbour at Dusk" }] }],
      },
      ctx,
    );
    expect(one.notices).toEqual([
      {
        key: "unsold_waiting",
        text: "Waiting for an owner or admin to choose what happens to “Harbour at Dusk”, which did not sell",
        href: "/selling/consignments?tab=unsold",
      },
    ]);
    const two = organisationHomeView(
      {
        ...model,
        state: organisationStatePolicy("approved", new Set()),
        notices: [
          {
            kind: "unsold_waiting",
            lots: [
              { id: "l1", title: "Harbour at Dusk" },
              { id: "l2", title: "Study in Ochre" },
            ],
          },
        ],
      },
      ctx,
    );
    expect(two.notices[0]?.text).toBe(
      "Waiting for an owner or admin to choose what happens to 2 unsold works",
    );
  });

  it("labels shortcuts and See all; Sell a work is the page's own action, not a shortcut", () => {
    const view = organisationHomeView(model, ctx);
    expect(view.shortcuts.map((s) => s.label)).toEqual(["Invite a member", "Statements"]);
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
        needsYouFailed: false,
        firstSteps: null,
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
      href: "/team#stopped-member-bids",
    });
  });
});

describe("member role copy", () => {
  it("explains a role in one paragraph from its abilities", () => {
    expect(roleExplanation("consignor", "Northbank Gallery")).toBe(
      "As a consignor at Northbank Gallery, you can send works to sell for the organisation and follow their progress. Anything else is done by its owners and admins. Your own bids, purchases and sales stay in your personal account; switch between them from the account menu.",
    );
  });

  it("reads naturally for every role", () => {
    expect(welcomeHeadline("admin", "Northbank Gallery")).toBe(
      "You're now an admin at Northbank Gallery.",
    );
    expect(welcomeHeadline("finance", "Northbank Gallery")).toBe(
      "You're now a finance member at Northbank Gallery.",
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
