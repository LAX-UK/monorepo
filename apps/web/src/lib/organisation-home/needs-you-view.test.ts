import { navCountsFrom } from "@/lib/workspace/needs-you-counts";
import { type NeedsYouTaskWithLink, parseNeedsYouResponse } from "@/lib/workspace/needs-you-read";
import { NEEDS_YOU_KINDS, buildOrganisationHome } from "@auction/domain";
import { describe, expect, it } from "vitest";
import { needsYouRowView } from "./needs-you-view";
import { organisationHomeView } from "./organisation-home-view";

const now = new Date("2026-10-30T09:00:00Z");
const ctx = { organisationName: "Northbank Gallery", now };

/** One task of every kind, as the reader serves it. */
const EVERY_TASK: NeedsYouTaskWithLink[] = [
  {
    kind: "outbid",
    lots: [{ id: "l88", title: "Sun over Arles", endsAt: new Date("2026-10-30T18:12:00Z") }],
    raisedAt: null,
    link: { page: "lot", id: "l88" },
  },
  {
    kind: "pay",
    purchases: [{ id: "l7", title: "Harbour at dawn" }],
    raisedAt: null,
    link: { page: "purchase", id: "l7" },
  },
  {
    kind: "won_awaiting_payment",
    purchases: [
      { id: "l7", title: "Harbour at dawn" },
      { id: "l8", title: "Marsh" },
    ],
    raisedAt: null,
    link: { page: "purchases" },
  },
  {
    kind: "unsold_due",
    lots: [{ id: "u1", title: "Night harbour" }],
    dueBy: new Date("2026-10-29T00:00:00Z"),
    raisedAt: null,
    link: { page: "consignments", view: "unsold" },
  },
  {
    kind: "agreement",
    consignment: { id: "c1", title: "Thames" },
    raisedAt: null,
    link: { page: "consignment", id: "c1" },
  },
  {
    kind: "changes",
    submission: { id: "s1", title: "Study" },
    note: "Add a photo",
    raisedAt: null,
    link: { page: "consignment", id: "s1" },
  },
  {
    kind: "reply",
    consignment: { id: "c2", title: "Thames at low tide" },
    from: "Clara Mendes",
    raisedAt: null,
    link: { page: "consignment_messages", id: "c2" },
  },
  {
    kind: "unsold",
    lots: [{ id: "u2", title: "Quiet tide" }],
    raisedAt: null,
    link: { page: "consignments", view: "unsold" },
  },
  {
    kind: "choose_delivery",
    purchases: [{ id: "l9", title: "Vase" }],
    raisedAt: null,
    link: { page: "purchase", id: "l9" },
  },
  {
    kind: "quote_ready",
    purchases: [{ id: "l9", title: "Vase" }],
    raisedAt: null,
    link: { page: "purchase", id: "l9" },
  },
  {
    kind: "book_collection",
    purchases: [{ id: "l9", title: "Vase" }],
    raisedAt: null,
    link: { page: "purchase", id: "l9" },
  },
  {
    kind: "register",
    sale: { id: "sale1", title: "Contemporary" },
    startsAt: new Date("2026-11-04T18:00:00Z"),
    bidLimit: "10000.00",
    raisedAt: null,
    link: { page: "sale", id: "sale1" },
  },
  {
    kind: "authorisation_ending",
    authorisations: [
      { id: "a1", memberName: "Tom Whitfield", endsAt: new Date("2026-11-03T00:00:00Z") },
    ],
    raisedAt: null,
    link: { page: "team", view: "who_can_bid" },
  },
  {
    kind: "invitations_expired",
    invitations: [{ id: "i1", email: "sam@northbank.gallery", expiredAt: new Date("2026-10-20") }],
    raisedAt: null,
    link: { page: "team", view: "invitations" },
  },
  {
    kind: "access_requests",
    requests: [{ id: "r1", requesterName: "Jonah Reed", askedAt: new Date("2026-10-30") }],
    raisedAt: null,
    link: { page: "team", view: "members" },
  },
  { kind: "documents", raisedAt: null, link: { page: "organisation", view: "documents" } },
  { kind: "identity", raisedAt: null, link: { page: "verify_identity" } },
  { kind: "source_of_funds", raisedAt: null, link: { page: "source_of_funds" } },
  { kind: "payouts", raisedAt: null, link: { page: "organisation", view: "payouts" } },
];

describe("needsYouRowView", () => {
  it("has words for every kind the reader has", () => {
    expect(EVERY_TASK.map((task) => task.kind).sort()).toEqual([...NEEDS_YOU_KINDS].sort());
    for (const task of EVERY_TASK) {
      const view = needsYouRowView(task, ctx);
      expect(view.title.length, task.kind).toBeGreaterThan(0);
      expect(view.detail.length, task.kind).toBeGreaterThan(0);
      expect(view.action.label.length, task.kind).toBeGreaterThan(0);
      expect(view.action.href.startsWith("/"), task.kind).toBe(true);
    }
  });

  it("leads each button to where the task is done", () => {
    const hrefs = Object.fromEntries(
      EVERY_TASK.map((task) => [task.kind, needsYouRowView(task, ctx).action.href]),
    );
    expect(hrefs).toMatchObject({
      outbid: "/lot/sun-over-arles/l88",
      pay: "/purchases/pay?lots=l7",
      won_awaiting_payment: "/purchases",
      unsold_due: "/selling/consignments?tab=unsold",
      agreement: "/selling/consignments/c1#agreement",
      changes: "/selling/consignments/s1",
      reply: "/selling/consignments/c2?tab=messages",
      register: "/sales/contemporary/sale1",
      authorisation_ending: "/team/bidding",
      invitations_expired: "/team/invitations",
      access_requests: "/team",
      payouts: "/organisation/payouts",
      identity: "/verify-identity",
      source_of_funds: "/compliance/source-of-funds",
    });
  });

  it("dates what has a date: a close time ahead in amber, a passed choice date in red", () => {
    const [outbid, , , unsoldDue] = EVERY_TASK.map((task) => needsYouRowView(task, ctx));
    expect(outbid?.due).toMatchObject({ tone: "warning" });
    expect(outbid?.due?.text).toMatch(/^Closes /);
    expect(unsoldDue?.due).toMatchObject({ tone: "danger", text: "Overdue" });
  });

  it("shows when a task arose: relative within a day, otherwise the date", () => {
    const base = EVERY_TASK.find((task) => task.kind === "pay");
    if (!base) throw new Error("fixture");
    const at = (raisedAt: Date | null) => needsYouRowView({ ...base, raisedAt }, ctx).raised;
    expect(at(new Date("2026-10-30T06:00:00Z"))).toEqual({
      text: "3 hours ago",
      dateTime: "2026-10-30T06:00:00.000Z",
    });
    expect(at(new Date("2026-10-27T10:00:00Z"))?.text).toBe("27\u00a0Oct\u00a02026");
  });

  it("shows no time when the task has none, never the current time", () => {
    expect(EVERY_TASK.map((task) => needsYouRowView(task, ctx).raised)).toEqual(
      EVERY_TASK.map(() => null),
    );
  });

  it("names the organisation on the binding step", () => {
    const agreement = EVERY_TASK.find((task) => task.kind === "agreement");
    expect(agreement && needsYouRowView(agreement, ctx).detail).toContain("Northbank Gallery");
  });
});

describe("parseNeedsYouResponse raisedAt", () => {
  const body = (raisedAt?: unknown) => ({
    data: {
      kinds: ["pay"],
      counts: { purchases: 1 },
      tasks: [
        {
          kind: "pay",
          purchases: [{ id: "l7", title: "Harbour at dawn" }],
          link: { page: "purchase", id: "l7" },
          ...(raisedAt === undefined ? {} : { raisedAt }),
        },
      ],
    },
  });

  it("reads the date the reader sends", () => {
    const [task] = parseNeedsYouResponse(body("2026-10-30T06:00:00.000Z"))?.tasks ?? [];
    expect(task?.raisedAt).toEqual(new Date("2026-10-30T06:00:00.000Z"));
  });

  it("reads null, and a reader that sends none, as no time", () => {
    expect(parseNeedsYouResponse(body(null))?.tasks[0]?.raisedAt).toBeNull();
    expect(parseNeedsYouResponse(body())?.tasks[0]?.raisedAt).toBeNull();
  });
});

describe("Home and the sidebar read the same answer", () => {
  const response = parseNeedsYouResponse({
    data: {
      kinds: ["outbid", "pay", "agreement", "unsold", "invitations_expired", "payouts"],
      counts: { bids: 1, purchases: 2, consignments: 2, team: 1, organisation: 1 },
      truncated: false,
      tasks: [
        {
          kind: "outbid",
          lots: [{ id: "l88", title: "Sun over Arles", endsAt: "2026-10-30T18:12:00Z" }],
          raisedAt: null,
          link: { page: "lot", id: "l88" },
        },
        {
          kind: "pay",
          purchases: [
            { id: "l7", title: "Harbour at dawn" },
            { id: "l8", title: "Marsh" },
          ],
          raisedAt: null,
          link: { page: "purchases" },
        },
        {
          kind: "agreement",
          consignment: { id: "c1", title: "Thames" },
          raisedAt: null,
          link: { page: "consignment", id: "c1" },
        },
        {
          kind: "unsold",
          lots: [{ id: "u2", title: "Quiet tide" }],
          raisedAt: null,
          link: { page: "consignments", view: "unsold" },
        },
        {
          kind: "invitations_expired",
          invitations: [{ id: "i1", email: "sam@northbank.gallery", expiredAt: "2026-10-20" }],
          raisedAt: null,
          link: { page: "team", view: "invitations" },
        },
        { kind: "payouts", raisedAt: null, link: { page: "organisation", view: "payouts" } },
      ],
    },
  });

  it("the things Home lists add up to the sidebar's count on every item", () => {
    expect(response).not.toBeNull();
    if (!response) return;
    const model = buildOrganisationHome(
      {
        actor: { role: "owner" },
        organisation: { status: "approved", payoutsReady: false },
        unsoldLots: [],
        teamInvited: true,
      },
      [],
      null,
      response,
    );
    const view = organisationHomeView(model, ctx);
    const home: Record<string, number> = {};
    for (const row of view.needsYou ?? []) {
      if (row.section) home[row.section] = (home[row.section] ?? 0) + row.items;
    }
    // A setup task shown as a first step stands for the same one thing on Organisation.
    for (const step of view.firstSteps?.steps ?? []) {
      if (step.state === "next" && step.id !== "invite") {
        home.organisation = (home.organisation ?? 0) + 1;
      }
    }
    expect(home).toEqual(navCountsFrom(response.counts));
  });
});
