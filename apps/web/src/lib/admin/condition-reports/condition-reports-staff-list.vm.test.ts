import type {
  AdminConditionReportListSummary,
  AdminConditionReportRequestRow,
} from "@/lib/data/http/admin-condition-reports.shared";
import { describe, expect, it } from "vitest";
import {
  conditionReportPanelHref,
  conditionReportsAttention,
  conditionReportsEmpty,
  conditionReportsListHref,
  conditionReportsMetrics,
  conditionReportsRangeSummary,
  conditionReportsViews,
  toConditionReportStaffRows,
} from "./condition-reports-staff-list.vm";

const row: AdminConditionReportRequestRow = {
  id: "req_1",
  lotId: "lot_1",
  requestedByUserId: "user_1",
  requestingLegalEntityId: null,
  status: "pending",
  requestNote: "  Is there restoration to the base?  ",
  responseNote: null,
  responseAttachmentUploadId: null,
  fulfilledByUserId: null,
  fulfilledAt: null,
  createdAt: "2026-10-01T09:00:00.000Z",
  lotTitle: "Blue Interior",
  requesterEmail: "ada@example.com",
};

const summary: AdminConditionReportListSummary = {
  total: 20,
  open: 5,
  pending: 3,
  inProgress: 2,
  fulfilled: 12,
  declined: 3,
};

describe("condition reports staff list view model", () => {
  it("names the status and links the lot and requester", () => {
    const [request] = toConditionReportStaffRows([row]);
    expect(request?.status).toEqual({ label: "Requested", tone: "warning" });
    expect(request?.lotTitle).toBe("Blue Interior");
    expect(request?.lotHref).toBe("/admin/lots/lot_1");
    expect(request?.requesterHref).toBe("/admin/clients/user_1");
    expect(request?.requestNote).toBe("Is there restoration to the base?");
    expect(request?.closed).toBe(false);
  });

  it("never shows an id for a missing title and leaves a missing requester empty", () => {
    const [request] = toConditionReportStaffRows([
      { ...row, lotTitle: null, requesterEmail: null, status: "declined" },
    ]);
    expect(request?.lotTitle).toBe("Untitled lot");
    expect(request?.requester).toBeNull();
    expect(request?.status).toEqual({ label: "Declined", tone: "neutral" });
    expect(request?.closed).toBe(true);
  });

  it("builds the status views with counts and no param for the default view", () => {
    const views = conditionReportsViews({ offset: "50", request: "req_1" }, summary);
    expect(views.map((view) => [view.id, view.count])).toEqual([
      ["open", 5],
      ["pending", 3],
      ["in_progress", 2],
      ["fulfilled", 12],
      ["declined", 3],
    ]);
    expect(views[0]?.href).toBe("/admin/condition-reports");
    expect(views[2]?.href).toBe("/admin/condition-reports?lens=in_progress");
  });

  it("leaves the counts out when the summary could not load", () => {
    expect(conditionReportsViews({}, null).every((view) => view.count === undefined)).toBe(true);
  });

  it("opens and closes the panel without dropping the view or page", () => {
    expect(conditionReportPanelHref({ lens: "pending", offset: "50" }, "req_1")).toBe(
      "/admin/condition-reports?lens=pending&offset=50&request=req_1",
    );
    expect(conditionReportPanelHref({ lens: "pending", request: "req_1" }, null)).toBe(
      "/admin/condition-reports?lens=pending",
    );
    expect(conditionReportsListHref({ offset: "50" }, { lens: "declined" })).toBe(
      "/admin/condition-reports?lens=declined",
    );
  });

  it("says one request is waiting in the singular", () => {
    const [one] = conditionReportsAttention({}, { ...summary, pending: 1 });
    expect(one).toMatchObject({
      count: 1,
      label: "request is waiting to be picked up",
      href: "/admin/condition-reports?lens=pending",
    });
    const [many] = conditionReportsAttention({}, summary);
    expect(many?.label).toBe("requests are waiting to be picked up");
  });

  it("shows four headline numbers from the summary", () => {
    expect(conditionReportsMetrics({ ...summary, total: 1234 }).map((m) => m.value)).toEqual([
      "5",
      "12",
      "3",
      "1,234",
    ]);
  });

  it("describes each empty view", () => {
    expect(conditionReportsEmpty("open").title).toBe("No open requests");
    expect(conditionReportsEmpty("declined").title).toBe("No declined requests");
  });

  it("summarises the range with the singular for one", () => {
    expect(conditionReportsRangeSummary(0, 50, 312)).toBe("1–50 of 312 requests");
    expect(conditionReportsRangeSummary(0, 1, 1)).toBe("1–1 of 1 request");
  });
});
