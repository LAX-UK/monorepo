import { describe, expect, it } from "vitest";
import { enquiryNextStatuses, enquiryTransitionRefusal } from "./marketing-enquiry-status.js";
import { ENQUIRY_STATUSES, type EnquiryStatus } from "./marketing-enquiry-vocabulary.js";

const request = (
  from: EnquiryStatus,
  to: EnquiryStatus,
  extra: { intent?: "general" | "private_sale_sell"; closeReason?: "spam"; manual?: boolean } = {},
) => ({
  from,
  to,
  intent: extra.intent ?? "general",
  closeReason: extra.closeReason,
  manual: extra.manual ?? true,
});

describe("enquiry status transitions", () => {
  it.each([
    ["new", "in_progress"],
    ["new", "waiting_on_client"],
    ["in_progress", "waiting_on_client"],
    ["waiting_on_client", "in_progress"],
    ["closed", "in_progress"],
  ] as const)("allows %s to %s", (from, to) => {
    expect(enquiryTransitionRefusal(request(from, to))).toBeNull();
  });

  it.each([
    ["new", "converted"],
    ["closed", "waiting_on_client"],
    ["closed", "new"],
    ["in_progress", "new"],
    ["converted", "in_progress"],
    ["converted", "closed"],
  ] as const)("refuses %s to %s", (from, to) => {
    expect(enquiryTransitionRefusal(request(from, to, { closeReason: undefined }))).toBe(
      "not_allowed",
    );
  });

  it("refuses staying where it is", () => {
    for (const status of ENQUIRY_STATUSES) {
      expect(enquiryTransitionRefusal(request(status, status))).toBe("unchanged");
    }
  });

  it("closes only with a reason, and a reason only closes", () => {
    expect(enquiryTransitionRefusal(request("new", "closed"))).toBe("close_reason_required");
    expect(enquiryTransitionRefusal(request("new", "closed", { closeReason: "spam" }))).toBeNull();
    expect(enquiryTransitionRefusal(request("new", "in_progress", { closeReason: "spam" }))).toBe(
      "close_reason_not_applicable",
    );
  });

  it("converts only private sale enquiries, and only through the convert flow", () => {
    expect(enquiryTransitionRefusal(request("in_progress", "converted"))).toBe(
      "conversion_unavailable",
    );
    expect(
      enquiryTransitionRefusal(
        request("in_progress", "converted", { intent: "private_sale_sell" }),
      ),
    ).toBe("conversion_not_manual");
    expect(
      enquiryTransitionRefusal(
        request("in_progress", "converted", { intent: "private_sale_sell", manual: false }),
      ),
    ).toBeNull();
  });

  it("lists where each status may go", () => {
    expect(enquiryNextStatuses("new")).toEqual(["in_progress", "waiting_on_client", "closed"]);
    expect(enquiryNextStatuses("converted")).toEqual([]);
  });
});
