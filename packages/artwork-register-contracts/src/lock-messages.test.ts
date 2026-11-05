import { describe, expect, it } from "vitest";
import { LOCK_LINK_TARGETS, LOCK_REASONS, lockMessage } from "./lock-messages.js";

describe("lockMessage", () => {
  it("has a message for every reason, in plain words with no internal terms", () => {
    for (const reason of LOCK_REASONS) {
      const { message } = lockMessage(reason);
      expect(message.length).toBeGreaterThan(0);
      expect(message).not.toMatch(/register|already offered in/i);
    }
  });

  it.each([
    [
      "live_on_lax_art",
      "This artwork is live on lax.art. Take it off lax.art first, or use Offer at auction to move it.",
      "Open on lax.art",
      "lax_art_listing",
    ],
    [
      "in_bid_sale",
      "This artwork is in a LAX Bid sale. Withdraw the lot there first.",
      "Open lot in LAX Bid",
      "bid_lot",
    ],
    [
      "in_private_sale",
      "This artwork is in a private sale. Withdraw it there first.",
      "Open private sale",
      "private_sale",
    ],
    [
      "sold_through_lax",
      "This artwork has been sold, so it can't be offered again.",
      "Where it was sold",
      "sold_place",
    ],
    [
      "sold_in_gallery",
      "Zoho shows this artwork as sold in the gallery, so it can't be offered.",
      "Edit in Zoho",
      "zoho_record",
    ],
    [
      "reserved_in_zoho",
      "Zoho shows this artwork as reserved. Offer it once Zoho shows it as available.",
      "Edit in Zoho",
      "zoho_record",
    ],
    [
      "buyer_holds",
      "A buyer has reserved this artwork, or an offer on it is open. Finish or cancel that sale first.",
      "Open the sale",
      "open_sale",
    ],
    [
      "not_linked",
      "Link this artwork to its Zoho record before publishing.",
      "Link to Zoho record…",
      "link_to_zoho",
    ],
  ] as const)("%s", (reason, message, label, target) => {
    expect(lockMessage(reason)).toEqual({ reason, message, link: { label, target } });
  });

  it("gives a print no link", () => {
    expect(lockMessage("print")).toEqual({
      reason: "print",
      message: "Prints are sold in runs on LAX Shop, not on lax.art or at auction.",
      link: null,
    });
  });

  it("only links to targets the products know how to open", () => {
    for (const reason of LOCK_REASONS) {
      const link = lockMessage(reason).link;
      if (link) expect(LOCK_LINK_TARGETS).toContain(link.target);
    }
  });

  it("names the sale and lot when it knows them, and only what it knows", () => {
    const named = (d: Parameters<typeof lockMessage>[1]) => lockMessage("in_bid_sale", d).message;
    expect(named({ saleName: "Winter Modern and Contemporary", lotNumber: "14" })).toBe(
      "This artwork is in a LAX Bid sale (Winter Modern and Contemporary, lot 14). Withdraw the lot there first.",
    );
    expect(named({ saleName: " Winter ", lotNumber: null })).toContain("(Winter)");
    expect(named({ lotNumber: 7 })).toContain("(lot 7)");
    expect(named({ saleName: "  ", lotNumber: "" })).toBe(named(undefined));
    expect(named({ lotNumber: 0 })).toContain("(lot 0)");
  });
});
