import type { DealSettlementFollowUp } from "@/lib/data/http/admin-private-sales.schema";
import { describe, expect, it } from "vitest";
import {
  markSoldErrorMessage,
  settlementNotice,
  settlementRowLabel,
} from "./settlement-follow-up.vm";

const deal = { reference: "PS-0014" };
const date = () => "Mon 30 Nov, 16:00 GMT";
const normal: DealSettlementFollowUp = {
  severity: "normal",
  settledAt: "2026-11-30T16:00:00.000Z",
  lock: null,
  canRetry: true,
};
const urgent: DealSettlementFollowUp = {
  severity: "urgent",
  settledAt: "2026-11-30T16:00:00.000Z",
  lock: {
    reason: "sold_in_gallery",
    message: "Zoho shows this artwork as sold in the gallery, so it can't be offered.",
    link: { label: "Edit in Zoho", target: "zoho_record", href: "https://crm.example/p/1" },
  },
  canRetry: true,
};

describe("settlementNotice", () => {
  it("warns, offers Try again and explains what Zoho shows meanwhile", () => {
    const view = settlementNotice(deal, normal, date);
    expect(view.tone).toBe("warning");
    expect(view.title).toBe(
      "PS-0014 settled, but the artwork's record couldn't be marked sold. Check where it is.",
    );
    expect(view.body).toContain("settled on Mon 30 Nov, 16:00 GMT");
    expect(view.body).toContain('Zoho shows "In a private sale" instead of "Sold privately"');
    expect(view.canRetry).toBe(true);
    expect(view.link).toBeNull();
  });

  it("does not offer Try again to a person who may not run deals", () => {
    expect(settlementNotice(deal, { ...normal, canRetry: false }, date).canRetry).toBe(false);
  });

  it("turns urgent when the register shows it elsewhere: its own words, the next step, no retry", () => {
    const view = settlementNotice(deal, urgent, date);
    expect(view.tone).toBe("danger");
    expect(view.body).toBe(
      "Zoho shows this artwork as sold in the gallery, so it can't be offered. It may have been sold twice. Talk to the Sales manager before anything else moves.",
    );
    expect(view.canRetry).toBe(false);
    expect(view.link).toEqual({ label: "Edit in Zoho", href: "https://crm.example/p/1" });
  });

  it("still says it is urgent when the register's words are missing", () => {
    const view = settlementNotice(deal, { ...urgent, lock: null }, date);
    expect(view.body).toContain("shows this artwork somewhere else");
    expect(view.link).toBeNull();
  });
});

describe("settlementRowLabel", () => {
  it("names the problem in the list", () => {
    expect(settlementRowLabel("normal")).toBe("Not marked sold");
    expect(settlementRowLabel("urgent")).toBe("Possible double sale");
  });
});

describe("markSoldErrorMessage", () => {
  const fallback = () => "fallback";
  it("prefers the register's own words, then the specific line, then the fallback", () => {
    expect(markSoldErrorMessage("artwork_unavailable", 409, "It is in a sale.", fallback)).toBe(
      "It is in a sale.",
    );
    expect(markSoldErrorMessage("artwork_register_busy", 503, undefined, fallback)).toContain(
      "The deal is unaffected",
    );
    expect(markSoldErrorMessage("not_applicable", 409, undefined, fallback)).toContain(
      "nothing to mark sold",
    );
    expect(markSoldErrorMessage("forbidden", 403, undefined, fallback)).toBe("fallback");
  });
});
