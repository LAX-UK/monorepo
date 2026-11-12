import { describe, expect, it } from "vitest";
import { bidStandings } from "./bid-standing";
import { BUYER_DEFAULT, PREVIEW, offer } from "./reoffer-fixtures";

const bids = [
  { id: "bid-1", bidderId: "buyer-1", amount: "88000.00" },
  { id: "bid-2", bidderId: "bidder-1", amount: "82000.00" },
  { id: "bid-3", bidderId: "bidder-2", amount: "75000.00" },
];
const bundle = (offers: ReturnType<typeof offer>[]) =>
  ({ status: "ready", buyerDefault: BUYER_DEFAULT, offers, preview: PREVIEW }) as const;

describe("bid standings after a default", () => {
  it("marks the defaulted bid and leaves the others as the tab shows them", () => {
    expect(bidStandings(bundle([]), bids)).toEqual({
      "bid-1": { label: "Defaulted", tone: "danger" },
    });
  });

  it.each([
    ["offered", "Offered"],
    ["accepted", "Accepted"],
    ["declined", "Declined"],
    ["expired", "Offer ended"],
    ["ready", "Next in line"],
  ] as const)("marks the bid an offer was made at when it is %s", (status, label) => {
    expect(bidStandings(bundle([offer({ status })]), bids)["bid-2"]?.label).toBe(label);
  });

  it("leaves the bid alone when the seller said no or the offer was withdrawn", () => {
    for (const status of ["seller_declined", "seller_lapsed", "withdrawn"] as const) {
      expect(bidStandings(bundle([offer({ status })]), bids)["bid-2"]).toBeUndefined();
    }
  });

  it("marks nothing without a default or when the load failed", () => {
    expect(bidStandings({ status: "failed" }, bids)).toEqual({});
    expect(bidStandings({ ...bundle([]), buyerDefault: null }, bids)).toEqual({});
  });
});
