import type { SellerReofferView } from "@auction/validators";
import { describe, expect, it } from "vitest";
import {
  type SellerReofferViewer,
  sellerReofferRows,
  sellerReofferState,
  sellerReofferVm,
} from "./seller-reoffer.vm";

const NOW = new Date("2026-11-12T10:00:00Z");

const view = (over: Partial<SellerReofferView> = {}): SellerReofferView => ({
  id: "11111111-1111-4111-8111-111111111111",
  lotId: "22222222-2222-4222-8222-222222222222",
  lotTitle: "The Winter Study",
  lotNumber: 2,
  lotEndedAt: "2026-10-29T18:00:00.000Z",
  status: "awaiting_seller",
  consentStatus: "requested",
  offerMinor: 8_200_000,
  originalHammerMinor: 8_800_000,
  estimatedProceedsMinor: 7_216_000,
  originalProceedsMinor: 7_744_000,
  reserveMinor: null,
  belowReserve: false,
  answerDueAt: "2026-11-13T17:00:00.000Z",
  answeredAt: null,
  answeredBy: null,
  declinePreference: null,
  offerEndsAt: null,
  soldAt: null,
  ...over,
});

const owner: SellerReofferViewer = { canAnswer: true, organisation: "Cedar & Stone" };
const viewer: SellerReofferViewer = { canAnswer: false, organisation: "Cedar & Stone" };
const vm = (v: SellerReofferView, who = owner) => sellerReofferVm(v, who, NOW);

describe("the state of a request", () => {
  it.each([
    [{}, "waiting"],
    [{ answerDueAt: "2026-11-12T09:00:00.000Z" }, "lapsed"],
    [{ status: "ready", consentStatus: "given" }, "agreed"],
    [{ status: "offered", consentStatus: "given" }, "agreed"],
    [{ status: "accepted", consentStatus: "given" }, "sold"],
    [{ status: "seller_declined", consentStatus: "refused" }, "declined"],
    [{ status: "seller_lapsed", consentStatus: "lapsed" }, "lapsed"],
    [{ status: "withdrawn" }, "withdrawn"],
    [{ status: "declined", consentStatus: "given" }, "not_taken_up"],
    [{ status: "expired", consentStatus: "given" }, "not_taken_up"],
    [{ consentStatus: "not_needed" }, "not_needed"],
  ] as const)("%j reads as %s", (over, state) => {
    expect(sellerReofferState(view(over as Partial<SellerReofferView>), NOW)).toBe(state);
  });
});

describe("the waiting request", () => {
  it("asks for an answer by the deadline, in London time, and shows the buttons to a member who may", () => {
    const page = vm(view());
    expect(page.chip).toMatchObject({ label: "Answer by Fri 13 Nov, 17:00 GMT", tone: "warning" });
    expect(page.card).toMatchObject({ heading: "The buyer didn't pay", answerable: true });
    expect(page.card.paragraphs.join(" ")).toContain("The next highest bidder bid £82,000.00");
    expect(page.subtitle).toBe("Lot 2 · ended Thu 29 Oct");
    expect(page.offer).toBe("£82,000.00");
    expect(page.proceeds).toBe("£72,160.00");
  });

  it("shows the proceeds at both prices, the fees and the difference", () => {
    expect(vm(view()).money?.rows).toEqual([
      { label: "Offer to the next bidder", value: "£82,000.00" },
      { label: "Commission and VAT on it", value: "−£9,840.00" },
      { label: "Estimated proceeds", value: "£72,160.00", strong: true },
      { label: "At the original £88,000.00", value: "£77,440.00" },
      { label: "Difference", value: "−£5,280.00" },
    ]);
  });

  it("is read-only for a member who may not answer, and says who can", () => {
    const page = vm(view(), viewer);
    expect(page.card.answerable).toBe(false);
    expect(page.card.paragraphs.join(" ")).toContain(
      "We've asked Cedar & Stone whether we may offer it to them.",
    );
    expect(page.card.paragraphs.join(" ")).not.toContain("If you'd rather not");
    expect(page.card.notice).toEqual({
      tone: "info",
      title: "Only the account's owners and admins can answer",
    });
  });

  it("says plainly when the offer is below the reserve, without saying the price twice", () => {
    const page = vm(view({ belowReserve: true, reserveMinor: 8_000_000, offerMinor: 7_500_000 }));
    expect(page.card.notice).toEqual({
      tone: "warning",
      title: "This is below your reserve of £80,000.00",
      detail: "The next bid is £75,000.00. We'll only offer it at this price if you agree.",
    });
    expect(page.card.paragraphs.join(" ")).not.toContain("The next highest bidder bid");
  });
});

describe("the request after it was answered", () => {
  it("agreed: when they agreed, and until when the next bidder can accept", () => {
    const page = vm(
      view({
        status: "offered",
        consentStatus: "given",
        answeredAt: "2026-11-11T10:00:00.000Z",
        answeredBy: "workspace",
        offerEndsAt: "2026-11-14T17:00:00.000Z",
      }),
    );
    expect(page.chip?.label).toBe("You agreed · Wed 11 Nov");
    expect(page.card.heading).toBe("We're offering it to the next bidder");
    expect(page.card.paragraphs).toEqual([
      "They have until Sat 14 Nov, 17:00 GMT to accept. We'll tell you either way.",
    ]);
    expect(page.card.notice).toBeNull();
    expect(page.card.answerable).toBe(false);
  });

  it("an answer recorded by our team says so", () => {
    const page = vm(
      view({
        status: "ready",
        consentStatus: "given",
        answeredAt: "2026-11-11T10:00:00.000Z",
        answeredBy: "recorded_by_staff",
      }),
    );
    expect(page.card.notice?.title).toBe("Our team recorded your answer");
    expect(page.card.paragraphs).toEqual([
      "We'll send them the offer shortly. We'll tell you either way.",
    ]);
  });

  it("sold: the price, the day, and what they will be paid, with no bidder named", () => {
    const page = vm(
      view({ status: "accepted", consentStatus: "given", soldAt: "2026-11-12T09:00:00.000Z" }),
    );
    expect(page.chip?.label).toBe("Sold after the auction");
    expect(page.card.heading).toBe("The Winter Study has a new buyer");
    expect(page.card.paragraphs).toEqual([
      "Sold for £82,000.00 on Thu 12 Nov. We'll pay you once their payment clears, about £72,160.00.",
    ]);
    expect(page.money).toBeNull();
  });

  it.each([
    ["later_sale", "We'll talk to you about including it in a later sale."],
    ["return_to_me", "We'll arrange to return it to you."],
    ["talk_to_us", "We'll be in touch to talk it through."],
  ] as const)("declined with %s", (declinePreference, sentence) => {
    const page = vm(
      view({
        status: "seller_declined",
        consentStatus: "refused",
        declinePreference,
        answeredAt: "2026-11-11T10:00:00.000Z",
      }),
    );
    expect(page.chip?.label).toBe("You said not this time · Wed 11 Nov");
    expect(page.card.paragraphs).toEqual([sentence]);
  });

  it("no reply: the request closed, a way to reach us, nothing to answer", () => {
    const page = vm(view({ status: "seller_lapsed", consentStatus: "lapsed" }));
    expect(page.card).toMatchObject({
      heading: "This request has closed",
      answerable: false,
      contact: true,
    });
    expect(page.card.paragraphs[0]).toContain("We didn't hear from you by Fri 13 Nov, 17:00 GMT");
  });

  it("withdrawn, and not taken up by the next bidder, are told without blame", () => {
    expect(vm(view({ status: "withdrawn" })).card.heading).toBe("This request was withdrawn");
    const declined = vm(view({ status: "declined", consentStatus: "given" }));
    expect(declined.card.paragraphs[0]).toContain("The next bidder declined our offer.");
    const expired = vm(view({ status: "expired", consentStatus: "given" }));
    expect(expired.card.paragraphs[0]).toContain("didn't answer in time");
  });

  it("LAX-owned stock needs no answer", () => {
    const page = vm(view({ consentStatus: "not_needed" }));
    expect(page.card).toMatchObject({ heading: "Nothing to answer", answerable: false });
    expect(page.chip).toBeNull();
  });
});

describe("the requests on Sold & payouts", () => {
  it("lists every request that waits, then the latest few that finished, and skips LAX-owned lots", () => {
    const waiting = view({ id: "w" });
    const closed = (id: string) => view({ id, status: "withdrawn" });
    const rows = sellerReofferRows(
      [
        closed("c1"),
        waiting,
        closed("c2"),
        closed("c3"),
        closed("c4"),
        view({ id: "own", consentStatus: "not_needed" }),
      ],
      NOW,
    );
    expect(rows.map((row) => row.id)).toEqual(["w", "c1", "c2", "c3"]);
    expect(rows[0]).toMatchObject({
      title: "The Winter Study",
      meta: ["Lot 2", "Ended Thu 29 Oct"],
      offer: "£82,000.00",
      badge: { label: "Needs your answer", tone: "warning" },
    });
  });
});
