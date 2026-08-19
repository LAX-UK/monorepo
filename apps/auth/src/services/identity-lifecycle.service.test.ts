import type { IdentityEventPublisher } from "@auction/auth";
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
  const tx = {
    update,
    delete: deleteFrom,
  };
  const db = {
    transaction: vi.fn(async (callback: (value: typeof tx) => Promise<void>) => callback(tx)),
  } as unknown as Database;
  const publish = vi.fn(async () => undefined);
  const publisher = { publish } as IdentityEventPublisher;
  return {
    service: new IdentityLifecycleService(db, publisher),
    update,
    set,
    deleteFrom,
    publish,
    tx,
  };
}

describe("IdentityLifecycleService", () => {
  it("disables Identity, revokes sessions and OAuth tokens, and appends the event", async () => {
    const disabledAt = new Date("2026-08-07T00:00:00.000Z");
    const { service, deleteFrom, publish, tx } = setup({ id: "subject-1", disabledAt });
    await service.disable("subject-1", "security_review");

    expect(deleteFrom).toHaveBeenCalledTimes(2);
    expect(publish).toHaveBeenCalledWith(
      expect.objectContaining({
        type: "user.identity_disabled",
        userId: "subject-1",
        reason: "security_review",
      }),
      { producer: "apps/auth", transaction: tx },
    );
  });

  it("enables Identity and appends the versioned event", async () => {
    const { service, publish, tx } = setup({ id: "subject-1" });
    await service.enable("subject-1");
    expect(publish).toHaveBeenCalledWith(
      { type: "user.identity_enabled", userId: "subject-1" },
      { producer: "apps/auth", transaction: tx },
    );
  });
});
