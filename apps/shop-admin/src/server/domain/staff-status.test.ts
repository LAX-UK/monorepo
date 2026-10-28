import {
  ADMIN_ARTWORK_STATES,
  ADMIN_DISPUTE_STATUSES,
  ADMIN_FULFILMENT_STATUSES,
  ADMIN_ORIGINAL_SALE_STATUSES,
  ADMIN_PAYOUT_STATUSES,
  ADMIN_SALE_AUTHORITY_REQUEST_STATUSES,
  ADMIN_STOCK_HOLD_STATUSES,
  ADMIN_THIRD_PARTY_SALE_STATUSES,
  ARTIST_APPLICATION_STATUS_VALUES,
  ENQUIRY_STATUSES,
  PRODUCTION_TASK_STATUSES,
} from "@auction/shop-contracts";
import { describe, expect, it } from "vitest";
import { type LaxStatusDomain, staffStatus } from "./staff-status";

const DOMAINS: [LaxStatusDomain, readonly string[]][] = [
  ["fulfilment", ADMIN_FULFILMENT_STATUSES],
  ["payout", ADMIN_PAYOUT_STATUSES],
  ["hold", ADMIN_STOCK_HOLD_STATUSES],
  ["thirdPartySale", ADMIN_THIRD_PARTY_SALE_STATUSES],
  ["originalSale", ADMIN_ORIGINAL_SALE_STATUSES],
  ["saleRequest", ADMIN_SALE_AUTHORITY_REQUEST_STATUSES],
  ["dispute", ADMIN_DISPUTE_STATUSES],
  ["production", PRODUCTION_TASK_STATUSES],
  ["artwork", ADMIN_ARTWORK_STATES],
  ["artist", ["active", "archived"]],
  ["edition", ["not_authorised", "authorised", "reserved", "held", "sold", "withdrawn"]],
  ["merchandise", ["active", "archived"]],
  ["editorial", ["draft", "published"]],
  ["help", ["draft", "published"]],
  ["enquiry", ENQUIRY_STATUSES],
  ["artistApplication", ARTIST_APPLICATION_STATUS_VALUES],
];

describe("staffStatus", () => {
  it.each(DOMAINS)("maps every %s status to words, never the raw value", (domain, statuses) => {
    for (const status of statuses) {
      const { label } = staffStatus(domain, status);
      expect(label).not.toContain("_");
      expect(label).not.toBe(status);
      expect(label.charAt(0)).toBe(label.charAt(0).toUpperCase());
      expect(label.slice(1)).not.toMatch(/[A-Z]{2,}/);
    }
  });

  it("gives the states that wait on staff the warning tone", () => {
    expect(staffStatus("payout", "due").tone).toBe("warning");
    expect(staffStatus("saleRequest", "pending").tone).toBe("warning");
    expect(staffStatus("dispute", "opened").tone).toBe("warning");
    expect(staffStatus("fee", "pending").tone).toBe("warning");
    expect(staffStatus("artistApplication", "submitted").tone).toBe("warning");
  });

  it("marks failures and losses as danger", () => {
    expect(staffStatus("production", "qc_failed").tone).toBe("danger");
    expect(staffStatus("dispute", "lost").tone).toBe("danger");
  });

  it("reads a declined request and a withdrawn one in the owner's words", () => {
    expect(staffStatus("saleRequest", "rejected").label).toBe("Declined");
    expect(staffStatus("saleRequest", "cancelled").label).toBe("Withdrawn");
  });

  it("still renders a status the API adds later, as words in the neutral tone", () => {
    expect(staffStatus("payout", "on_hold")).toEqual({ label: "On hold", tone: "neutral" });
  });
});
