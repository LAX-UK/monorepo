import { describe, expect, it, vi } from "vitest";
import type { IdentityDatabase } from "./drizzle-consent-store.js";
import { createDrizzleIdentityOutboxPublisher } from "./drizzle-identity-outbox-publisher.js";

describe("identity outbox publisher: data export requested", () => {
  it("writes ids only, keyed by the export, in the caller's transaction", async () => {
    const values = vi.fn(() => ({ onConflictDoNothing: async () => undefined }));
    const transaction = { insert: vi.fn(() => ({ values })) } as unknown as IdentityDatabase;
    const own = { insert: vi.fn() } as unknown as IdentityDatabase;
    await createDrizzleIdentityOutboxPublisher(own).publish(
      { type: "subject.data_export_requested", userId: "u1", exportId: "e1" },
      { transaction },
    );
    expect(own.insert).not.toHaveBeenCalled();
    expect(values).toHaveBeenCalledWith({
      aggregateType: "subject_data_export",
      aggregateId: "e1",
      eventType: "subject.data_export_requested",
      producer: "apps/auth",
      actorUserId: "u1",
      schemaVersion: 1,
      payload: { schemaVersion: 1, subjectId: "u1", exportId: "e1" },
    });
  });
});
