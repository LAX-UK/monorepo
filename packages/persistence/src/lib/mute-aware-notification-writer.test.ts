import { describe, expect, it, vi } from "vitest";
import type { CreateNotificationRow } from "../interfaces/notification-write.repository.js";
import { MuteAwareNotificationWriter } from "./mute-aware-notification-writer.js";

const row = (userId: string, legalEntityId: string | null): CreateNotificationRow => ({
  userId,
  legalEntityId,
  type: "outbid",
  title: "t",
  message: "m",
});

function writer(muted: Record<string, string[]>) {
  const createMany = vi.fn(async (rows: CreateNotificationRow[]) =>
    rows.map((r, i) => ({
      ...r,
      id: `n${i}`,
      lotId: null,
      submissionId: null,
      read: false,
      createdAt: new Date(),
    })),
  );
  const listMutedAccountIds = vi.fn(async (userId: string) => muted[userId] ?? []);
  return {
    w: new MuteAwareNotificationWriter({ createMany }, { listMutedAccountIds }),
    createMany,
    listMutedAccountIds,
  };
}

describe("MuteAwareNotificationWriter", () => {
  it("drops notices about an organisation the recipient muted and keeps the rest", async () => {
    const { w, createMany } = writer({ ada: ["org-north"] });
    await w.createMany([
      row("ada", "org-north"),
      row("ada", "org-cedar"),
      row("ada", null),
      row("grace", "org-north"),
    ]);
    expect(createMany.mock.calls[0]?.[0].map((r) => `${r.userId}:${r.legalEntityId}`)).toEqual([
      "ada:org-cedar",
      "ada:null",
      "grace:org-north",
    ]);
  });

  it("never reads mutes for personal notices", async () => {
    const { w, listMutedAccountIds } = writer({});
    await w.createMany([row("ada", null)]);
    expect(listMutedAccountIds).not.toHaveBeenCalled();
  });

  it("reads each recipient's mutes once per batch", async () => {
    const { w, listMutedAccountIds } = writer({});
    await w.createMany([row("ada", "org-1"), row("ada", "org-2")]);
    expect(listMutedAccountIds).toHaveBeenCalledTimes(1);
  });
});
