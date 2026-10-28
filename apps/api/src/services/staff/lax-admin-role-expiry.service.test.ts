import type { LaxAdminRoleEnd } from "@auction/persistence/interfaces";
import { describe, expect, it, vi } from "vitest";
import { LaxAdminRoleExpiryService, StaffRoleExpiryJob } from "./lax-admin-role-expiry.service.js";

const NOW = new Date("2026-11-04T03:00:00.000Z");

function end(assignmentId: string, subjectId: string): LaxAdminRoleEnd {
  return { assignmentId, subjectId, role: "editor", endedAt: new Date("2026-11-03T23:30:00Z") };
}

describe("LaxAdminRoleExpiryService", () => {
  it("asks for each due end once and tells the people involved, as LAX Admin roles", async () => {
    const queue = [[end("a1", "ada"), end("a2", "ada")], [end("a3", "bo")], []];
    const requests = { requestDueEnds: vi.fn(async () => queue.shift() ?? []) };
    const notifier = { notifyEnded: vi.fn().mockResolvedValue(undefined) };
    const service = new LaxAdminRoleExpiryService(requests, notifier, () => NOW, 2);

    expect(await service.expireEndedRoles()).toEqual({ expired: 3, people: 2 });
    expect(notifier.notifyEnded).toHaveBeenCalledTimes(2);
    expect(notifier.notifyEnded.mock.calls[0]?.[0]).toEqual([
      expect.objectContaining({
        product: "shop",
        assignmentId: "a1",
        userId: "ada",
        role: "editor",
      }),
      expect.objectContaining({ product: "shop", assignmentId: "a2" }),
    ]);
  });

  it("tells nobody when nothing is due, so a second run sends nothing", async () => {
    const requests = { requestDueEnds: vi.fn().mockResolvedValue([]) };
    const notifier = { notifyEnded: vi.fn() };
    const service = new LaxAdminRoleExpiryService(requests, notifier, () => NOW);
    expect(await service.expireEndedRoles()).toEqual({ expired: 0, people: 0 });
    expect(notifier.notifyEnded).not.toHaveBeenCalled();
  });
});

describe("StaffRoleExpiryJob", () => {
  it("runs both admins' expiry in one job and adds up the result", async () => {
    const bid = { expireEndedRoles: vi.fn().mockResolvedValue({ expired: 2, people: 1 }) };
    const lax = { expireEndedRoles: vi.fn().mockResolvedValue({ expired: 1, people: 1 }) };
    expect(await new StaffRoleExpiryJob([bid, lax]).expireEndedRoles()).toEqual({
      expired: 3,
      people: 2,
    });
  });
});
