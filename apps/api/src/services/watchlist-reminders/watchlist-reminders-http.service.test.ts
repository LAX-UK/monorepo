import type { IWatchlistReminderRepository } from "@auction/persistence/interfaces";
import { describe, expect, it, vi } from "vitest";
import { WatchlistRemindersHttpService } from "./watchlist-reminders-http.service.js";

const row = {
  lotId: "lot-1",
  kind: "day_before_close" as const,
  note: "Check the frame",
  sentAt: null,
  updatedAt: new Date("2026-11-01T10:00:00Z"),
};

function setup(watched = true) {
  const reminders: IWatchlistReminderRepository = {
    listForUser: vi.fn(async () => [row]),
    set: vi.fn(async () => (watched ? row : null)),
    clear: vi.fn(async () => undefined),
    listPending: vi.fn(),
    markSent: vi.fn(),
  };
  return { service: new WatchlistRemindersHttpService(reminders), reminders };
}

describe("WatchlistRemindersHttpService", () => {
  it("lists the person's own reminders", async () => {
    const { service, reminders } = setup();
    expect(await service.list("u1")).toEqual({
      kind: "ok",
      data: [{ lotId: "lot-1", kind: "day_before_close", note: "Check the frame", sentAt: null }],
    });
    expect(reminders.listForUser).toHaveBeenCalledWith("u1");
  });

  it("sets a reminder on a watched lot", async () => {
    const { service, reminders } = setup();
    const outcome = await service.set("u1", "lot-1", { kind: "day_before_close", note: "x" });
    expect(outcome.kind).toBe("ok");
    expect(reminders.set).toHaveBeenCalledWith("u1", "lot-1", {
      kind: "day_before_close",
      note: "x",
    });
  });

  it("refuses a lot the person doesn't watch", async () => {
    const { service } = setup(false);
    expect(await service.set("u1", "lot-2", { kind: "sale_start", note: null })).toMatchObject({
      kind: "err",
      error: { status: 404, code: "not_watching" },
    });
  });

  it("clears with no content", async () => {
    const { service } = setup();
    expect(await service.clear("u1", "lot-1")).toEqual({ kind: "no_content" });
  });
});
