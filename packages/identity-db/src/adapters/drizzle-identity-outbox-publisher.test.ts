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

  it("records a removed sign-in method in the caller's transaction, naming only the provider", async () => {
    const values = vi.fn(() => ({ onConflictDoNothing: vi.fn() }));
    const transaction = { insert: vi.fn(() => ({ values })) } as unknown as IdentityDatabase;
    await createDrizzleIdentityOutboxPublisher({
      insert: vi.fn(),
    } as unknown as IdentityDatabase).publish(
      { type: "user.sign_in_method_unlinked", userId: "u1", provider: "google" },
      { transaction },
    );
    expect(values).toHaveBeenCalledWith(
      expect.objectContaining({
        aggregateType: "user",
        aggregateId: "u1",
        eventType: "user.sign_in_method_unlinked",
        payload: expect.objectContaining({ subjectId: "u1", provider: "google" }),
      }),
    );
  });

  it("records a removed unconfirmed password, naming only the provider that proved the email", async () => {
    const values = vi.fn(() => ({ onConflictDoNothing: vi.fn() }));
    const transaction = { insert: vi.fn(() => ({ values })) } as unknown as IdentityDatabase;
    await createDrizzleIdentityOutboxPublisher({
      insert: vi.fn(),
    } as unknown as IdentityDatabase).publish(
      { type: "user.unconfirmed_password_removed", userId: "u1", provider: "apple" },
      { transaction },
    );
    expect(values).toHaveBeenCalledWith(
      expect.objectContaining({
        aggregateId: "u1",
        eventType: "user.unconfirmed_password_removed",
        payload: expect.objectContaining({ subjectId: "u1", provider: "apple" }),
      }),
    );
  });

  it("records a refused staff Google or Apple link or sign-in, with no personal fields", async () => {
    const values = vi.fn(() => ({ onConflictDoNothing: vi.fn() }));
    const transaction = { insert: vi.fn(() => ({ values })) } as unknown as IdentityDatabase;
    await createDrizzleIdentityOutboxPublisher({
      insert: vi.fn(),
    } as unknown as IdentityDatabase).publish(
      { type: "user.social_link_refused_staff", userId: "u1", provider: "google", attempt: "link" },
      { transaction },
    );
    const [row] = (values.mock.calls[0] ?? []) as unknown as [{ payload: Record<string, unknown> }];
    expect(row).toMatchObject({ eventType: "user.social_link_refused_staff", aggregateId: "u1" });
    expect(Object.keys(row.payload).sort()).toEqual([
      "attempt",
      "provider",
      "refusedAt",
      "schemaVersion",
      "subjectId",
    ]);
  });
});
