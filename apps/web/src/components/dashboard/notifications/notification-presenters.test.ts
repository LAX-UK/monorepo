import { notificationTypePresenter } from "@/components/dashboard/notifications/notification-presenters";
import { describe, expect, it } from "vitest";

describe("notificationTypePresenter", () => {
  it("maps condition_report_ready", () => {
    const p = notificationTypePresenter("condition_report_ready");
    expect(p.label).toBe("Condition report");
    expect(p.tone).toBe("success");
  });

  it("labels both staff role notices as a staff role", () => {
    for (const type of ["staff_role_expired", "staff_role_expired_admin"]) {
      const p = notificationTypePresenter(type);
      expect(p.label).toBe("Staff role");
      expect(p.tone).toBe("neutral");
    }
  });

  it("maps condition_report_declined", () => {
    const p = notificationTypePresenter("condition_report_declined");
    expect(p.label).toBe("Condition report");
    expect(p.tone).toBe("warn");
  });
});
