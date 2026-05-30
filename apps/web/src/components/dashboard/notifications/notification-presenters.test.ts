import { notificationTypePresenter } from "@/components/dashboard/notifications/notification-presenters";
import { describe, expect, it } from "vitest";

describe("notificationTypePresenter", () => {
  it("maps condition_report_ready", () => {
    const p = notificationTypePresenter("condition_report_ready");
    expect(p.label).toBe("Condition report");
    expect(p.tone).toBe("success");
  });

  it("maps condition_report_declined", () => {
    const p = notificationTypePresenter("condition_report_declined");
    expect(p.label).toBe("Condition report");
    expect(p.tone).toBe("warn");
  });
});
