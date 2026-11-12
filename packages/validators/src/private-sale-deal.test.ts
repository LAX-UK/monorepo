import { describe, expect, it } from "vitest";
import {
  adminDealArtworkRemoveSchema,
  adminDealArtworkSearchQuerySchema,
  adminDealArtworkSetSchema,
  adminDealConvertSchema,
  dealArtworkLockSchema,
  dealArtworkSearchResultSchema,
} from "./private-sale-deal.js";

const REGISTER_ID = "5b1c1b9e-3a2f-4f6e-9c1d-2f7a8e9d0c11";

describe("adminDealConvertSchema", () => {
  it("takes an artwork from the register", () => {
    expect(adminDealConvertSchema.safeParse({ artworkRegisterId: REGISTER_ID }).success).toBe(true);
  });

  it.each(["sellers_own_work", "in_zoho_not_linked"])(
    "takes %s as the reason the artwork is not in the register",
    (reason) => {
      const parsed = adminDealConvertSchema.safeParse({ notInRegister: { reason } });
      expect(parsed.success).toBe(true);
    },
  );

  it("keeps the consignment reference of a buy enquiry beside either choice", () => {
    const parsed = adminDealConvertSchema.parse({
      workReference: " c-1042 ",
      notInRegister: { reason: "sellers_own_work" },
    });
    expect(parsed.workReference).toBe("c-1042");
  });

  it("leaves the exactly-one rule to the conversion, which answers artwork_choice_required", () => {
    expect(adminDealConvertSchema.safeParse({}).success).toBe(true);
    expect(
      adminDealConvertSchema.safeParse({
        artworkRegisterId: REGISTER_ID,
        notInRegister: { reason: "sellers_own_work" },
      }).success,
    ).toBe(true);
  });

  it.each([
    ["a reason that is not offered", { notInRegister: { reason: "lost" } }],
    ["a missing reason", { notInRegister: {} }],
    ["extra keys beside the reason", { notInRegister: { reason: "sellers_own_work", note: "x" } }],
    ["an artwork id that is not a uuid", { artworkRegisterId: "123" }],
    [
      "a work reference that is not one",
      { workReference: "hello", artworkRegisterId: REGISTER_ID },
    ],
  ])("rejects %s", (_label, input) => {
    expect(adminDealConvertSchema.safeParse(input).success).toBe(false);
  });
});

describe("adminDealArtworkSearchQuerySchema", () => {
  it("defaults to an empty search and a page of 20", () => {
    expect(adminDealArtworkSearchQuerySchema.parse({})).toEqual({ q: "", limit: 20 });
  });

  it("trims the text and reads the limit from the query string", () => {
    expect(
      adminDealArtworkSearchQuerySchema.parse({
        q: "  harbour ",
        enquiry: "E-1042",
        work: "C-1042",
        limit: "5",
      }),
    ).toEqual({ q: "harbour", enquiry: "E-1042", work: "C-1042", limit: 5 });
  });

  it.each([
    ["a limit of 0", { limit: "0" }],
    ["a limit over 50", { limit: "51" }],
    ["text over 100 characters", { q: "x".repeat(101) }],
    ["an enquiry that is not a reference", { enquiry: "1042" }],
    ["a work that is not a reference", { work: "hello" }],
  ])("rejects %s", (_label, input) => {
    expect(adminDealArtworkSearchQuerySchema.safeParse(input).success).toBe(false);
  });
});

describe("dealArtworkSearchResultSchema", () => {
  const option = {
    id: REGISTER_ID,
    title: "Harbour at dusk",
    artist: "Tom Morris",
    medium: null,
    size: null,
    stockCode: "LAX-ORI-TM-GAC-26-0001",
    catalogueStatus: "Available",
    thumbnailUrl: null,
    whereItIs: {
      key: "lax_art",
      chip: { label: "On lax.art", tone: "success", marker: "filled" },
    },
    available: false,
    lock: {
      reason: "live_on_lax_art",
      message: "This artwork is live on lax.art.",
      link: { label: "Open on lax.art", target: "lax_art_listing" },
    },
    suggested: false,
  };

  it("describes an artwork that cannot be held, with the register's reason and link", () => {
    expect(
      dealArtworkSearchResultSchema.safeParse({
        items: [option],
        hasMore: false,
        preselected: null,
      }).success,
    ).toBe(true);
  });

  it("refuses a place or reason the register does not use", () => {
    const bad = { ...option, whereItIs: { ...option.whereItIs, key: "elsewhere" } };
    expect(
      dealArtworkSearchResultSchema.safeParse({ items: [bad], hasMore: false, preselected: null })
        .success,
    ).toBe(false);
  });
});

describe("adminDealArtworkSetSchema", () => {
  const ART = "5b1c1b9e-3a2f-4f6e-9c1d-2f7a8e9d0c11";

  it("takes an artwork, or a reason it is not in the register, against a version", () => {
    expect(
      adminDealArtworkSetSchema.safeParse({ version: 3, artworkRegisterId: ART }).success,
    ).toBe(true);
    expect(
      adminDealArtworkSetSchema.safeParse({
        version: 3,
        notInRegister: { reason: "sellers_own_work" },
      }).success,
    ).toBe(true);
  });

  it("trims the reason for a change and refuses an empty or very long one", () => {
    const parsed = adminDealArtworkSetSchema.parse({
      version: 3,
      artworkRegisterId: ART,
      reason: "  Chose it.  ",
    });
    expect(parsed.reason).toBe("Chose it.");
    expect(
      adminDealArtworkSetSchema.safeParse({ version: 3, artworkRegisterId: ART, reason: "   " })
        .success,
    ).toBe(false);
    expect(
      adminDealArtworkSetSchema.safeParse({
        version: 3,
        artworkRegisterId: ART,
        reason: "x".repeat(501),
      }).success,
    ).toBe(false);
  });

  it.each([
    ["no version", { artworkRegisterId: ART }],
    ["a zero version", { version: 0, artworkRegisterId: ART }],
    ["an id that is not one", { version: 3, artworkRegisterId: "nope" }],
    ["a reason that does not exist", { version: 3, notInRegister: { reason: "lost" } }],
    [
      "extra keys on the reason",
      { version: 3, notInRegister: { reason: "sellers_own_work", x: 1 } },
    ],
  ])("refuses %s", (_label, body) => {
    expect(adminDealArtworkSetSchema.safeParse(body).success).toBe(false);
  });
});

describe("adminDealArtworkRemoveSchema", () => {
  it("needs the reason the deal has no register artwork, and takes an optional note", () => {
    expect(
      adminDealArtworkRemoveSchema.safeParse({
        version: 3,
        notInRegister: { reason: "in_zoho_not_linked" },
        reason: "Wrong record.",
      }).success,
    ).toBe(true);
    expect(adminDealArtworkRemoveSchema.safeParse({ version: 3 }).success).toBe(false);
  });
});

describe("a lock with an address", () => {
  it("carries the link's address, or none", () => {
    for (const href of ["/admin/lots/1", null, undefined]) {
      const parsed = dealArtworkLockSchema.safeParse({
        reason: "in_bid_sale",
        message: "In a sale.",
        link: {
          label: "Open lot in LAX Bid",
          target: "bid_lot",
          ...(href !== undefined ? { href } : {}),
        },
      });
      expect(parsed.success).toBe(true);
    }
  });
});
