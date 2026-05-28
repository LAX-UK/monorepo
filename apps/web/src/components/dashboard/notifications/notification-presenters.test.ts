import {
  DATE_BANDS,
  dateBand,
  groupByDateBand,
} from "@/components/dashboard/notifications/notification-presenters";
import type { UserNotification } from "@auction/types";
import { describe, expect, it } from "vitest";

function notification(id: string, createdAt: Date | string): UserNotification {
  return {
    id,
    userId: "user-1",
    type: "outbid",
    title: `Notice ${id}`,
    message: "Body",
    lotId: null,
    read: false,
    createdAt: createdAt instanceof Date ? createdAt : new Date(createdAt),
  };
}

describe("dateBand", () => {
  const now = new Date("2026-05-28T15:00:00.000Z");

  it("groups ISO string dates the same as Date instances", () => {
    const todayIso = "2026-05-28T10:00:00.000Z";
    expect(dateBand(todayIso, now)).toBe("Today");
    expect(dateBand(new Date(todayIso), now)).toBe("Today");
  });

  it("returns Earlier for invalid dates", () => {
    expect(dateBand("not-a-date", now)).toBe("Earlier");
  });
});

describe("groupByDateBand", () => {
  const now = new Date("2026-05-28T15:00:00.000Z");

  it("preserves DATE_BANDS order with string createdAt from SSR", () => {
    const items: UserNotification[] = [
      {
        ...notification("old", "2026-05-01T10:00:00.000Z"),
        createdAt: "2026-05-01T10:00:00.000Z" as unknown as Date,
      },
      {
        ...notification("today", "2026-05-28T09:00:00.000Z"),
        createdAt: "2026-05-28T09:00:00.000Z" as unknown as Date,
      },
    ];

    const groups = groupByDateBand(items, now);
    expect(groups.map((g) => g.band)).toEqual(["Today", "Earlier"]);
    expect(groups[0]?.items.map((n) => n.id)).toEqual(["today"]);
    expect(groups[1]?.items.map((n) => n.id)).toEqual(["old"]);
  });

  it("only emits bands that have items", () => {
    const items = [notification("today", new Date("2026-05-28T09:00:00.000Z"))];
    const groups = groupByDateBand(items, now);
    expect(groups.map((g) => g.band)).toEqual(["Today"]);
    expect(DATE_BANDS).toContain("Yesterday");
  });
});
