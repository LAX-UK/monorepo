import { describe, expect, it } from "vitest";
import { bidUpdateAnnouncement, lotClosedAnnouncement } from "./my-bids-live";

const LOT = { lotId: "l14", lotLabel: "14", title: "Still life with stoneware jug" };

describe("bidUpdateAnnouncement", () => {
  it("says first when the person has been outbid", () => {
    expect(bidUpdateAnnouncement({ currentPrice: "4400", outbidUserId: "me" }, LOT, "me")).toBe(
      "You've been outbid on lot 14. Now £4,400.00.",
    );
  });

  it("says when the person's own bid leads, and otherwise names the new price", () => {
    expect(bidUpdateAnnouncement({ currentPrice: "4600", placedByUserId: "me" }, LOT, "me")).toBe(
      "You're winning lot 14 at £4,600.00.",
    );
    expect(bidUpdateAnnouncement({ currentPrice: "4800" }, LOT, "me")).toBe(
      "New bid on lot 14: £4,800.00.",
    );
  });

  it("names a lot without a number by its title", () => {
    expect(lotClosedAnnouncement({ ...LOT, lotLabel: null })).toBe(
      "Still life with stoneware jug has closed.",
    );
    expect(lotClosedAnnouncement(LOT)).toBe("Lot 14 has closed.");
  });
});
