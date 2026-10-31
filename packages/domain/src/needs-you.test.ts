import type { LegalEntityMemberRole } from "@auction/types";
import { describe, expect, it } from "vitest";
import {
  NEEDS_YOU_KINDS,
  NEEDS_YOU_NOTIFICATION_TYPES,
  type NeedsYouFacts,
  type NeedsYouKind,
  needsYouCounts,
  needsYouKindAnnouncedBy,
  needsYouKindsFor,
  needsYouLink,
  needsYouTasks,
  unsoldChoiceDueBy,
} from "./needs-you.js";
import { NOTIFICATION_NEEDS_ACTION_TYPES } from "./notification-needs-action.js";

const NOW = new Date("2026-11-10T12:00:00Z");
const DAY = 86_400_000;
const daysAgo = (n: number) => new Date(NOW.getTime() - n * DAY);
const inHours = (n: number) => new Date(NOW.getTime() + n * 3_600_000);

/** An organisation with something of every kind waiting. */
function busy(role: LegalEntityMemberRole, overrides: Partial<NeedsYouFacts> = {}): NeedsYouFacts {
  return {
    actor: { role },
    organisation: { status: "approved", payoutsReady: false },
    now: NOW,
    viewerIdentity: "required",
    sourceOfFundsRequested: false,
    agreementsToAccept: [{ id: "c1", title: "Untitled (Blue)" }],
    changesRequested: [{ id: "s1", title: "Study in Ochre", note: "Add a photo" }],
    unsoldLots: [
      // Ended 12 days ago: due in 2 days.
      { id: "u1", title: "Harbour at Dusk", dueBy: unsoldChoiceDueBy(daysAgo(12)) },
      // Ended yesterday: due in 13 days.
      { id: "u2", title: "Field", dueBy: unsoldChoiceDueBy(daysAgo(1)) },
    ],
    purchases: [
      { id: "p1", title: "Lot 14", paymentStatus: null, fulfilment: null, shippingQuote: null },
      {
        id: "p2",
        title: "Lot 15",
        paymentStatus: "captured",
        fulfilment: null,
        shippingQuote: null,
      },
      {
        id: "p3",
        title: "Lot 16",
        paymentStatus: "captured",
        fulfilment: { status: "released", method: null, collectedAt: null },
        shippingQuote: "ready",
      },
      {
        id: "p4",
        title: "Lot 17",
        paymentStatus: "captured",
        fulfilment: { status: "ready_for_collection", method: "collection", collectedAt: null },
        shippingQuote: null,
      },
    ],
    salesToRegister: [
      { id: "sale1", title: "Contemporary", startsAt: new Date("2026-11-14"), bidLimit: null },
    ],
    outbidLots: [
      { id: "l2", title: "Later lot", endsAt: inHours(30) },
      { id: "l1", title: "Closing lot", endsAt: inHours(2) },
    ],
    expiredInvitations: [{ id: "i1", email: "sam@example.com", expiredAt: daysAgo(2) }],
    endingAuthorisations: [{ id: "a1", memberName: "Agnes", endsAt: inHours(48) }],
    ...overrides,
  };
}

const kinds = (facts: NeedsYouFacts) => needsYouTasks(facts).map((task) => task.kind);

describe("the Needs you table", () => {
  it("ranks money and time first, then binding steps, the rest of the work, then setup", () => {
    expect(NEEDS_YOU_KINDS).toEqual([
      "outbid",
      "pay",
      "won_awaiting_payment",
      "unsold_due",
      "agreement",
      "changes",
      "unsold",
      "choose_delivery",
      "quote_ready",
      "book_collection",
      "register",
      "authorisation_ending",
      "invitations_expired",
      "documents",
      "identity",
      "source_of_funds",
      "payouts",
    ]);
  });

  const AUDIENCE: Record<LegalEntityMemberRole, NeedsYouKind[]> = {
    owner: [
      "outbid",
      "pay",
      "unsold_due",
      "agreement",
      "changes",
      "unsold",
      "choose_delivery",
      "quote_ready",
      "book_collection",
      "authorisation_ending",
      "invitations_expired",
      "documents",
      "source_of_funds",
      "payouts",
    ],
    admin: [
      "outbid",
      "pay",
      "unsold_due",
      "agreement",
      "changes",
      "unsold",
      "choose_delivery",
      "quote_ready",
      "book_collection",
      "authorisation_ending",
      "invitations_expired",
      "documents",
      "source_of_funds",
      "payouts",
    ],
    finance: [
      "pay",
      "choose_delivery",
      "quote_ready",
      "book_collection",
      "source_of_funds",
      "payouts",
    ],
    consignor: ["changes", "identity", "source_of_funds"],
    buyer_agent: [
      "outbid",
      "won_awaiting_payment",
      "register",
      "authorisation_ending",
      "identity",
      "source_of_funds",
    ],
    viewer: ["source_of_funds"],
  };

  for (const [role, expected] of Object.entries(AUDIENCE)) {
    it(`${role}: may be asked for ${expected.length} kinds`, () => {
      expect(needsYouKindsFor({ role: role as LegalEntityMemberRole })).toEqual(expected);
    });
  }

  it("owner: every task in rank order", () => {
    expect(kinds(busy("owner"))).toEqual([
      "outbid",
      "pay",
      "unsold_due",
      "agreement",
      "changes",
      "unsold",
      "choose_delivery",
      "quote_ready",
      "book_collection",
      "authorisation_ending",
      "invitations_expired",
      "payouts",
    ]);
  });

  it("buyer agent: outbid first, then wins finance pays, sales to register and their authorisation", () => {
    expect(kinds(busy("buyer_agent"))).toEqual([
      "outbid",
      "won_awaiting_payment",
      "register",
      "authorisation_ending",
      "identity",
    ]);
  });

  it("an impersonating admin is read-only: nothing to do", () => {
    expect(kinds(busy("owner", { actor: { role: "owner", isImpersonation: true } }))).toEqual([]);
  });

  it("a restricted organisation offers no bidding, selling or invitations", () => {
    const restricted = { status: "restricted" as const, payoutsReady: true };
    expect(kinds(busy("owner", { organisation: restricted }))).toEqual([
      "pay",
      "choose_delivery",
      "quote_ready",
      "book_collection",
      "authorisation_ending",
    ]);
  });

  it("an organisation with nothing waiting asks for nothing", () => {
    const quiet = busy("owner", {
      organisation: { status: "approved", payoutsReady: true },
      agreementsToAccept: [],
      changesRequested: [],
      unsoldLots: [],
      purchases: [],
      salesToRegister: [],
      outbidLots: [],
      expiredInvitations: [],
      endingAuthorisations: [],
    });
    expect(needsYouTasks(quiet)).toEqual([]);
    expect(needsYouCounts([])).toEqual({
      bids: 0,
      purchases: 0,
      consignments: 0,
      team: 0,
      organisation: 0,
    });
  });
});

describe("tasks", () => {
  const tasks = needsYouTasks(busy("owner"));
  const task = <K extends NeedsYouKind>(kind: K) => tasks.find((t) => t.kind === kind);

  it("outbid: the lot closing soonest first", () => {
    expect(task("outbid")).toEqual({
      kind: "outbid",
      lots: [
        { id: "l1", title: "Closing lot", endsAt: inHours(2) },
        { id: "l2", title: "Later lot", endsAt: inHours(30) },
      ],
    });
  });

  it("splits unsold lots by when the choice is due", () => {
    expect(task("unsold_due")).toEqual({
      kind: "unsold_due",
      lots: [{ id: "u1", title: "Harbour at Dusk" }],
      dueBy: new Date(daysAgo(12).getTime() + 14 * DAY),
    });
    expect(task("unsold")).toEqual({ kind: "unsold", lots: [{ id: "u2", title: "Field" }] });
  });

  it("puts each purchase under its one next step", () => {
    expect(task("pay")).toEqual({ kind: "pay", purchases: [{ id: "p1", title: "Lot 14" }] });
    expect(task("choose_delivery")).toEqual({
      kind: "choose_delivery",
      purchases: [{ id: "p2", title: "Lot 15" }],
    });
    expect(task("quote_ready")).toEqual({
      kind: "quote_ready",
      purchases: [{ id: "p3", title: "Lot 16" }],
    });
    expect(task("book_collection")).toEqual({
      kind: "book_collection",
      purchases: [{ id: "p4", title: "Lot 17" }],
    });
  });

  it("counts the things on each sidebar item", () => {
    expect(needsYouCounts(tasks)).toEqual({
      bids: 2,
      purchases: 4,
      consignments: 4,
      team: 2,
      organisation: 1,
    });
  });
});

describe("links", () => {
  const owner = { role: "owner" as const };
  const agent = { role: "buyer_agent" as const };
  const lot = (id: string) => ({ id, title: id, endsAt: NOW });

  it("one record opens itself; several open their list", () => {
    expect(needsYouLink({ kind: "outbid", lots: [lot("l1")] }, owner)).toEqual({
      page: "lot",
      id: "l1",
    });
    expect(needsYouLink({ kind: "outbid", lots: [lot("l1"), lot("l2")] }, owner)).toEqual({
      page: "bids",
    });
    expect(needsYouLink({ kind: "pay", purchases: [{ id: "p1", title: "A" }] }, owner)).toEqual({
      page: "purchase",
      id: "p1",
    });
  });

  it("an ending authorisation opens Who can bid for managers and Bid settings for the agent", () => {
    const task = {
      kind: "authorisation_ending" as const,
      authorisations: [{ id: "a1", memberName: "Agnes", endsAt: NOW }],
    };
    expect(needsYouLink(task, owner)).toEqual({ page: "team", view: "who_can_bid" });
    expect(needsYouLink(task, agent)).toEqual({ page: "bid_settings" });
  });
});

describe("notifications that announce a task", () => {
  /** The inbox's "Needs action" types: each must belong to exactly one task kind. */
  const NEEDS_ACTION: readonly string[] = NOTIFICATION_NEEDS_ACTION_TYPES;

  it("maps every needs-action notification to its task", () => {
    expect(NEEDS_ACTION.map(needsYouKindAnnouncedBy)).toEqual([
      "outbid",
      "pay",
      "agreement",
      "changes",
      "identity",
      "source_of_funds",
    ]);
    expect([...NEEDS_YOU_NOTIFICATION_TYPES].sort()).toEqual([...NEEDS_ACTION].sort());
  });

  it("ignores informational notifications", () => {
    expect(needsYouKindAnnouncedBy("lot_ending_soon")).toBeNull();
  });
});
