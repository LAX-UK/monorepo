import { describe, expect, it } from "vitest";
import {
  adminDealArtworkSearchQuerySchema,
  adminDealConvertSchema,
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

  it.each([
    ["neither", {}],
    ["only a consignment", { workReference: "C-1042" }],
    ["both", { artworkRegisterId: REGISTER_ID, notInRegister: { reason: "sellers_own_work" } }],
  ])("needs exactly one of the two: not %s", (_label, input) => {
    const parsed = adminDealConvertSchema.safeParse(input);
    expect(parsed.success).toBe(false);
    if (!parsed.success) {
      expect(parsed.error.issues[0]?.message).toBe(
        "Choose an artwork from the register, or say why it is not there",
      );
      expect(parsed.error.issues[0]?.path).toEqual(["artworkRegisterId"]);
    }
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
