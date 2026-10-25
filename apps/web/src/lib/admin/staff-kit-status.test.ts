import { describe, expect, it } from "vitest";
import { staffArrivalStatus, staffStatus } from "./staff-kit-status";

describe("staffStatus", () => {
  it("tells a draft lot from a scheduled one", () => {
    expect(staffStatus("lot", "draft")).toEqual({ label: "Draft", tone: "neutral" });
    expect(staffStatus("lot", "scheduled")).toEqual({ label: "Scheduled", tone: "info" });
  });

  it("shows a live lot and a live sale as happening now", () => {
    expect(staffStatus("lot", "active")).toEqual({ label: "Live", tone: "danger", live: true });
    expect(staffStatus("sale", "active")).toEqual({ label: "Live", tone: "danger", live: true });
  });

  it("names a withdrawn lot with the word staff use for the action", () => {
    expect(staffStatus("lot", "cancelled")).toEqual({ label: "Withdrawn", tone: "danger" });
    expect(staffStatus("sale", "cancelled")).toEqual({ label: "Cancelled", tone: "danger" });
  });

  it("reads an ended lot as sold or unsold when the outcome is known", () => {
    expect(staffStatus("lot", "ended", { lot: { hasWinner: true } })).toEqual({
      label: "Sold",
      tone: "success",
    });
    expect(staffStatus("lot", "ended", { lot: { winnerId: null } })).toEqual({
      label: "Unsold",
      tone: "neutral",
    });
    expect(staffStatus("lot", "ended")).toEqual({ label: "Ended", tone: "neutral" });
  });

  it("maps every submission status to a readable label", () => {
    expect(staffStatus("submission", "under_review")).toEqual({
      label: "Under review",
      tone: "warning",
    });
    expect(staffStatus("submission", "converted")).toEqual({
      label: "Converted to lot",
      tone: "success",
    });
    expect(staffStatus("submission", "withdrawn").tone).toBe("neutral");
  });

  it("maps condition report requests, including the legacy pending value", () => {
    expect(staffStatus("conditionReport", "requested")).toEqual({
      label: "Requested",
      tone: "warning",
    });
    expect(staffStatus("conditionReport", "pending").label).toBe("Requested");
    expect(staffStatus("conditionReport", "in_progress")).toEqual({
      label: "In progress",
      tone: "info",
    });
    expect(staffStatus("conditionReport", "declined").tone).toBe("neutral");
  });

  it("maps onsite event statuses, including closed RSVPs", () => {
    expect(staffStatus("onsiteEvent", "published")).toEqual({
      label: "Published",
      tone: "success",
    });
    expect(staffStatus("onsiteEvent", "draft").tone).toBe("neutral");
    expect(staffStatus("onsiteEvent", "closed").label).toBe("RSVPs closed");
  });

  it("tells an arrived guest from one still expected", () => {
    expect(staffArrivalStatus(true)).toEqual({ label: "Arrived", tone: "success" });
    expect(staffArrivalStatus(false)).toEqual({ label: "Not arrived", tone: "neutral" });
  });

  it("never shows a raw value for a status it does not know", () => {
    expect(staffStatus("sale", "awaiting_settlement")).toEqual({
      label: "Awaiting settlement",
      tone: "neutral",
    });
    expect(staffStatus("payment", "pending_refund_period").label).toBe("Pending refund period");
  });

  it("keeps the registry tones for the other families", () => {
    expect(staffStatus("payout", "failed").tone).toBe("danger");
  });
});
