import { describe, expect, it } from "vitest";
import {
  buildArtworkEnquiryItem,
  buildGeneralEnquiryItem,
  mapEnquiryStatus,
  mergeEnquiryItems,
} from "./account-enquiries.vm.js";

const artworkRow = {
  enquiryId: "a1",
  artworkId: "w1",
  artworkSlug: "warm-basket",
  artworkTitle: "Warm Basket",
  salesChannel: "art" as const,
  intent: "enquiry",
  status: "open",
  message: "Is this still available?",
  contactPhone: null,
  createdAt: "2026-03-01T10:00:00.000Z",
};

const generalRow = {
  enquiryId: "g1",
  topic: "private_viewing" as const,
  contextSlug: null,
  message: "x".repeat(200),
  phone: null,
  createdAt: "2026-04-01T10:00:00.000Z",
};

describe("mapEnquiryStatus", () => {
  it("maps known statuses to awaiting and replied tones", () => {
    expect(mapEnquiryStatus("open")).toEqual({ label: "Awaiting reply", tone: "pending" });
    expect(mapEnquiryStatus("Replied")).toEqual({ label: "Replied", tone: "success" });
  });

  it("keeps unknown statuses readable on a neutral tone", () => {
    expect(mapEnquiryStatus("on_hold")).toEqual({ label: "On hold", tone: "neutral" });
  });
});

describe("enquiry items", () => {
  it("builds an artwork item that links to the work", () => {
    expect(buildArtworkEnquiryItem(artworkRow)).toMatchObject({
      variant: "artwork",
      typeLabel: "Artwork enquiry",
      title: "Warm Basket",
      description: "Is this still available?",
      href: "/artworks/warm-basket",
      status: { tone: "pending" },
      createdAtLabel: "1 Mar 2026",
    });
  });

  it("builds a general item without status or link and truncates the message", () => {
    const item = buildGeneralEnquiryItem(generalRow);
    expect(item).toMatchObject({
      typeLabel: "Private viewing",
      title: "Private viewing",
      href: null,
      status: null,
    });
    expect(item.description).toHaveLength(158);
  });

  it("labels non-viewing topics as general enquiries", () => {
    expect(buildGeneralEnquiryItem({ ...generalRow, topic: "selling" })).toMatchObject({
      typeLabel: "General enquiry",
      title: "Selling a work",
    });
  });

  it("handles a missing artwork message", () => {
    expect(buildArtworkEnquiryItem({ ...artworkRow, message: undefined }).description).toBeNull();
  });
});

describe("mergeEnquiryItems", () => {
  it("interleaves both kinds newest first", () => {
    const merged = mergeEnquiryItems(
      [buildArtworkEnquiryItem(artworkRow)],
      [buildGeneralEnquiryItem(generalRow)],
    );
    expect(merged.map((item) => item.id)).toEqual(["g1", "a1"]);
  });
});
