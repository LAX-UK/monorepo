import { describe, expect, it } from "vitest";
import { consignmentDetailTab, consignmentDetailTabItems } from "./consignment-detail-tabs";

describe("consignment detail tabs", () => {
  it("reads the tab from the address, defaulting to the overview", () => {
    expect(consignmentDetailTab("messages")).toBe("messages");
    expect(consignmentDetailTab("history")).toBe("overview");
    expect(consignmentDetailTab(undefined)).toBe("overview");
  });

  it("counts messages, in ink while some are unread", () => {
    const quiet = consignmentDetailTabItems({
      submissionId: "s1",
      messages: { total: 3, unread: 0 },
    });
    expect(quiet[1]).toEqual({
      id: "messages",
      label: "Messages",
      href: "/selling/consignments/s1?tab=messages",
      count: 3,
      countLabel: "messages",
    });
    const waiting = consignmentDetailTabItems({
      submissionId: "s1",
      messages: { total: 3, unread: 1 },
    });
    expect(waiting[1]).toMatchObject({
      count: 1,
      countTone: "attention",
      countLabel: "unread message",
    });
  });

  it("shows no count with no messages or when they could not be read", () => {
    for (const messages of [{ total: 0, unread: 0 }, null]) {
      expect(consignmentDetailTabItems({ submissionId: "s1", messages })[1]).not.toHaveProperty(
        "count",
      );
    }
  });
});
