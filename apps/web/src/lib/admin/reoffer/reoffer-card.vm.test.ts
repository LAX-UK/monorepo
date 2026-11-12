import type { StaffReoffer } from "@auction/validators";
import { describe, expect, it } from "vitest";
import { READ_ONLY_NOTE, buildReofferCard } from "./reoffer-card.vm";
import { BUYER_DEFAULT, NO_PREVIEW, PREVIEW, offer } from "./reoffer-fixtures";

const ACT = { canAct: true, canRecordAnswer: true };

function card(
  offers: StaffReoffer[],
  options: { preview?: typeof PREVIEW; access?: typeof ACT } = {},
) {
  return buildReofferCard({
    buyerDefault: BUYER_DEFAULT,
    offers,
    preview: options.preview ?? PREVIEW,
    access: options.access ?? ACT,
  });
}

const actionIds = (model: ReturnType<typeof card>) => model.actions.map((action) => action.id);
const step = (model: ReturnType<typeof card>, id: string) =>
  model.steps.find((candidate) => candidate.id === id);

describe("the Re-offer card", () => {
  it("always tells the four steps, starting from the recorded default", () => {
    const model = card([offer()]);
    expect(model.steps.map((s) => s.label)).toEqual([
      "Buyer default recorded",
      "Seller's agreement",
      "Offer to the next bidder",
      "Accepted and invoiced",
    ]);
    expect(step(model, "default")?.details).toEqual([
      "Invoice LAX-B-2026-0412 voided · by Eleanor Pereira",
    ]);
  });

  describe("before any offer", () => {
    it("offers to start when someone is next in line, and says who", () => {
      const model = card([]);
      expect(model.badge).toBeNull();
      expect(model.position).toBeNull();
      expect(actionIds(model)).toEqual(["start", "return_to_inventory"]);
      expect(step(model, "offer")?.details[0]).toContain("Hollis Byrne · bid £75,000.00");
    });

    it("says why nobody can be offered the lot, and only offers to return it", () => {
      const model = card([], { preview: NO_PREVIEW });
      expect(actionIds(model)).toEqual(["return_to_inventory"]);
      expect(model.notice?.body).toBe("No one else bid on this lot.");
    });
  });

  describe("each state of an offer", () => {
    const cases: [
      string,
      Partial<StaffReoffer>,
      { badge: string; actions: string[]; seller: string; offerStep: string },
    ][] = [
      [
        "waiting for the seller",
        {},
        {
          badge: "Waiting for the seller",
          actions: ["record_answer", "withdraw"],
          seller: "current",
          offerStep: "todo",
        },
      ],
      [
        "ready to send",
        { status: "ready", consentStatus: "given" },
        {
          badge: "Ready to send",
          actions: ["send", "withdraw"],
          seller: "done",
          offerStep: "current",
        },
      ],
      [
        "offer sent",
        {
          status: "offered",
          consentStatus: "given",
          offerSentAt: "2026-11-11T10:00:00.000Z",
          offerEndsAt: "2026-11-14T17:00:00.000Z",
        },
        { badge: "Offer sent", actions: ["withdraw"], seller: "done", offerStep: "current" },
      ],
      [
        "accepted",
        {
          status: "accepted",
          consentStatus: "given",
          offerSentAt: "2026-11-11T10:00:00.000Z",
          respondedAt: "2026-11-12T14:05:00.000Z",
        },
        { badge: "Accepted", actions: [], seller: "done", offerStep: "done" },
      ],
      [
        "declined",
        {
          status: "declined",
          consentStatus: "given",
          offerSentAt: "2026-11-11T10:00:00.000Z",
          declineReason: "Over our budget now.",
        },
        {
          badge: "Declined",
          actions: ["next_bidder", "return_to_inventory"],
          seller: "done",
          offerStep: "stopped",
        },
      ],
      [
        "offer ended",
        {
          status: "expired",
          consentStatus: "given",
          offerSentAt: "2026-11-11T10:00:00.000Z",
          offerEndsAt: "2026-11-14T17:00:00.000Z",
        },
        {
          badge: "Offer ended",
          actions: ["next_bidder", "return_to_inventory"],
          seller: "done",
          offerStep: "stopped",
        },
      ],
      [
        "seller declined",
        { status: "seller_declined", consentStatus: "refused" },
        {
          badge: "Seller declined",
          actions: ["return_to_inventory"],
          seller: "stopped",
          offerStep: "todo",
        },
      ],
      [
        "no reply from the seller",
        { status: "seller_lapsed", consentStatus: "lapsed" },
        {
          badge: "No reply from the seller",
          actions: ["record_answer", "return_to_inventory"],
          seller: "stopped",
          offerStep: "todo",
        },
      ],
      [
        "withdrawn",
        { status: "withdrawn", closeReason: "Seller away", closedByName: "Eleanor Pereira" },
        {
          badge: "Withdrawn",
          actions: ["next_bidder", "return_to_inventory"],
          seller: "current",
          offerStep: "stopped",
        },
      ],
    ];

    it.each(cases)("%s", (_name, overrides, expected) => {
      const model = card([offer(overrides)]);
      expect(model.badge?.label).toBe(expected.badge);
      expect(actionIds(model)).toEqual(expected.actions);
      expect(step(model, "seller")?.state).toBe(expected.seller);
      expect(step(model, "offer")?.state).toBe(expected.offerStep);
      expect(model.position).toBe("Offer 1 of up to 3");
    });
  });

  it("names who is next in line, and that the seller is asked again at a lower price", () => {
    const model = card([
      offer({
        status: "declined",
        consentStatus: "given",
        offerSentAt: "2026-11-11T10:00:00.000Z",
      }),
    ]);
    expect(model.notice).toEqual({
      title: "Next in line: Hollis Byrne, £75,000.00",
      body: "Offer 2 of up to 3. The seller will be asked again, because the price is lower.",
    });
  });

  it("stops offering after three offers have reached a bidder", () => {
    const sent = "2026-11-11T10:00:00.000Z";
    const closed = { status: "declined", consentStatus: "given", offerSentAt: sent } as const;
    const model = card(
      [
        offer({ ...closed, id: "a", sequence: 1 }),
        offer({ ...closed, id: "b", sequence: 2 }),
        offer({ ...closed, id: "c", sequence: 3 }),
      ],
      { preview: { ...NO_PREVIEW, noneReason: "offer_limit_reached", offersMade: 3 } },
    );
    expect(actionIds(model)).toEqual(["return_to_inventory"]);
    expect(model.notice?.title).toBe("Offer limit reached");
    expect(model.position).toBe("Offer 3 of up to 3");
  });

  it("shows the seller's refusal with what they would like instead", () => {
    const model = card([
      offer({
        status: "seller_declined",
        consentStatus: "refused",
        consent: {
          ...offer().consent,
          channel: "workspace",
          answeredByName: "Priya Shah",
          answeredAt: "2026-11-11T09:02:00.000Z",
          declinePreference: "later_sale",
        },
      }),
    ]);
    expect(step(model, "seller")?.details[0]).toBe(
      "Declined by Priya Shah · prefers: include it in a later sale",
    );
  });

  it("shows a staff-recorded answer with its note, and LAX-owned stock without consent", () => {
    const recorded = card([
      offer({
        status: "ready",
        consentStatus: "given",
        consent: {
          ...offer().consent,
          channel: "recorded_by_staff",
          answeredByName: "Eleanor Pereira",
          note: "Phone: spoke to Priya",
          answeredAt: "2026-11-11T09:02:00.000Z",
        },
      }),
    ]);
    expect(step(recorded, "seller")?.details[0]).toBe(
      "Recorded by Eleanor Pereira: Phone: spoke to Priya",
    );
    const house = card([offer({ status: "ready", consentStatus: "not_needed" })]);
    expect(step(house, "seller")?.details[0]).toBe("LAX-owned, no consent needed");
  });

  describe("who may act", () => {
    it("leaves out every button and says so for someone who can only look", () => {
      const model = card([offer({ status: "ready", consentStatus: "given" })], {
        access: { canAct: false, canRecordAnswer: false },
      });
      expect(model.actions).toEqual([]);
      expect(model.readOnlyNote).toBe(READ_ONLY_NOTE);
    });

    it("keeps recording the seller's answer apart from acting on the offer", () => {
      const onlyAct = card([offer()], { access: { canAct: true, canRecordAnswer: false } });
      expect(actionIds(onlyAct)).toEqual(["withdraw"]);
      expect(onlyAct.readOnlyNote).toBeNull();
      const onlyAnswer = card([offer()], { access: { canAct: false, canRecordAnswer: true } });
      expect(actionIds(onlyAnswer)).toEqual(["record_answer"]);
    });
  });
});
