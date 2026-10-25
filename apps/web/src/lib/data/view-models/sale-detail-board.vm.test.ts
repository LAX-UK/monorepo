import { describe, expect, it } from "vitest";
import {
  documentVisibilityTone,
  filterSaleDocuments,
  matchesSaleDocumentSearch,
} from "./sale-documents-tab.vm";
import {
  filterSaleMediaItems,
  matchesSaleMediaSearch,
  saleMediaPublishedTone,
} from "./sale-media-tab.vm";
import {
  filterSaleRegistrations,
  matchesSaleRegistrationSearch,
  registrationCheckInStatus,
} from "./sale-registrations-tab.vm";

describe("sale-registrations-tab.vm", () => {
  const rows = [
    {
      id: "1",
      status: "pending" as const,
      userName: "Alice",
      userEmail: "alice@example.com",
      paddleNumber: null,
      checkedInAt: null,
    },
    {
      id: "2",
      status: "approved" as const,
      userName: "Bob",
      userEmail: "bob@example.com",
      paddleNumber: 12,
      checkedInAt: "2026-01-01T10:00:00Z",
    },
  ] as never;

  it("filterSaleRegistrations filters pending and checked in", () => {
    expect(filterSaleRegistrations(rows, "pending")).toHaveLength(1);
    expect(filterSaleRegistrations(rows, "checked_in")).toHaveLength(1);
  });

  it("matchesSaleRegistrationSearch matches paddle number", () => {
    expect(matchesSaleRegistrationSearch(rows[1], "12")).toBe(true);
    expect(matchesSaleRegistrationSearch(rows[0], "bob")).toBe(false);
  });

  it("registrationCheckInStatus follows the bidder to the door", () => {
    expect(registrationCheckInStatus(rows[1])?.label).toBe("Checked in");
    expect(registrationCheckInStatus(rows[0])).toBeNull();
    const approved = { status: "approved", checkedInAt: null, paddleNumber: null } as never;
    expect(registrationCheckInStatus(approved)?.label).toBe("Awaiting paddle");
  });
});

describe("sale-documents-tab.vm", () => {
  const docs = [
    {
      id: "d1",
      kind: "terms",
      label: "Terms",
      fileName: "terms.pdf",
      createdAt: new Date("2026-01-01"),
    },
    {
      id: "d2",
      kind: "other",
      label: "Internal memo",
      fileName: "memo.pdf",
      createdAt: new Date("2026-01-02"),
    },
  ] as never;

  it("filterSaleDocuments splits sale and internal", () => {
    expect(filterSaleDocuments(docs, "sale")).toHaveLength(1);
    expect(filterSaleDocuments(docs, "internal")).toHaveLength(1);
  });

  it("matchesSaleDocumentSearch matches label", () => {
    expect(matchesSaleDocumentSearch(docs[0], "terms")).toBe(true);
    expect(matchesSaleDocumentSearch(docs[1], "terms")).toBe(false);
  });

  it("documentVisibilityTone maps public docs to info", () => {
    expect(documentVisibilityTone(docs[0])).toBe("info");
    expect(documentVisibilityTone(docs[1])).toBe("pending");
  });
});

describe("sale-media-tab.vm", () => {
  const items = [{ key: "photo-1", caption: "Saleroom floor" }] as never;

  it("filterSaleMediaItems respects published state", () => {
    expect(filterSaleMediaItems(items, "published", true)).toHaveLength(1);
    expect(filterSaleMediaItems(items, "drafts", true)).toHaveLength(0);
    expect(filterSaleMediaItems(items, "drafts", false)).toHaveLength(1);
  });

  it("matchesSaleMediaSearch matches caption", () => {
    expect(matchesSaleMediaSearch(items[0], "saleroom")).toBe(true);
  });

  it("saleMediaPublishedTone maps published to success", () => {
    expect(saleMediaPublishedTone(true)).toBe("success");
    expect(saleMediaPublishedTone(false)).toBe("draft");
  });
});
