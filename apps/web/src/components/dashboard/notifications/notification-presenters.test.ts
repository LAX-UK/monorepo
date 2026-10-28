import {
  groupByDateBand,
  notificationTypePresenter,
} from "@/components/dashboard/notifications/notification-presenters";
import type { UserNotification } from "@auction/types";
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

describe("groupByDateBand", () => {
  const now = new Date(2026, 4, 28, 15, 0);
  const item = (id: string, at: Date, read: boolean): UserNotification => ({
    id,
    userId: "u1",
    type: "outbid",
    title: id,
    message: "",
    lotId: null,
    submissionId: null,
    read,
    createdAt: at,
  });

  it("groups by day and puts unread first within each day, newest first otherwise", () => {
    const groups = groupByDateBand(
      [
        item("today-read", new Date(2026, 4, 28, 14), true),
        item("today-unread", new Date(2026, 4, 28, 12), false),
        item("today-unread-older", new Date(2026, 4, 28, 9), false),
        item("earlier", new Date(2026, 3, 1), false),
      ],
      now,
    );
    expect(groups.map((g) => [g.band, g.items.map((i) => i.id)])).toEqual([
      ["Today", ["today-unread", "today-unread-older", "today-read"]],
      ["Earlier", ["earlier"]],
    ]);
  });
});
