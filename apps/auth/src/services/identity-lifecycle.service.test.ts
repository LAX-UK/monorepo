import type { Database } from "@auction/db";
import { describe, expect, it, vi } from "vitest";
import { IdentityLifecycleService } from "./identity-lifecycle.service.js";

function setup(returned: Record<string, unknown>) {
  const returning = vi.fn(async () => [returned]);
  const updateWhere = vi.fn(() => ({ returning }));
  const set = vi.fn(() => ({ where: updateWhere }));
  const update = vi.fn(() => ({ set }));
  const deleteWhere = vi.fn(async () => undefined);
  const deleteFrom = vi.fn(() => ({ where: deleteWhere }));
  const values = vi.fn(async () => undefined);
  const insert = vi.fn(() => ({ values }));
  const tx = {
    update,
    delete: deleteFrom,
    insert,
  };
  const db = {
    transaction: vi.fn(async (callback: (value: typeof tx) => Promise<void>) => callback(tx)),
  } as unknown as Database;
  return { service: new IdentityLifecycleService(db), update, set, deleteFrom, insert, values };
}

describe("IdentityLifecycleService", () => {
  it("disables Identity, revokes sessions and OAuth tokens, and appends the event", async () => {
    const disabledAt = new Date("2026-08-07T00:00:00.000Z");
    const { service, deleteFrom, values } = setup({ id: "subject-1", disabledAt });
    await service.disable("subject-1", "security_review");

    expect(deleteFrom).toHaveBeenCalledTimes(2);
    expect(values).toHaveBeenCalledWith(
      expect.objectContaining({
        aggregateId: "subject-1",
        eventType: "user.identity_disabled",
        producer: "apps/auth",
        payload: expect.objectContaining({
          subjectId: "subject-1",
          reason: "security_review",
          schemaVersion: 1,
        }),
      }),
    );
  });

  it("enables Identity and appends the versioned event", async () => {
    const { service, values } = setup({ id: "subject-1" });
    await service.enable("subject-1");
    expect(values).toHaveBeenCalledWith(
      expect.objectContaining({
        aggregateId: "subject-1",
        eventType: "user.identity_enabled",
        payload: expect.objectContaining({ subjectId: "subject-1", schemaVersion: 1 }),
      }),
    );
  });
});
