import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ProjectorRunContext } from "./lib/projector.types.js";

const { ensureBidUserProfile, writeBidUserProfile } = vi.hoisted(() => ({
  ensureBidUserProfile: vi.fn(),
  writeBidUserProfile: vi.fn(),
}));

vi.mock("@auction/persistence/bid-user-profile-sync", () => ({
  ensureBidUserProfile,
  writeBidUserProfile,
}));

import { processBidProfileProvisioning } from "./bid-profile-provisioning.js";

describe("processBidProfileProvisioning", () => {
  beforeEach(() => vi.clearAllMocks());

  it("resets delivery state only for email updates and projects identity lifecycle", async () => {
    const rows = [
      {
        id: 1,
        eventType: "user.profile_updated",
        payload: {
          schemaVersion: 1,
          subjectId: "email-changed",
          email: "next@example.test",
          updatedAt: "2026-08-01T00:00:00.000Z",
        },
      },
      {
        id: 2,
        eventType: "user.profile_updated",
        payload: {
          schemaVersion: 1,
          subjectId: "name-changed",
          name: "Updated Name",
          updatedAt: "2026-08-02T00:00:00.000Z",
        },
      },
      {
        id: 3,
        eventType: "user.identity_disabled",
        payload: {
          schemaVersion: 1,
          subjectId: "disabled",
          disabledAt: "2026-08-03T00:00:00.000Z",
        },
      },
      {
        id: 4,
        eventType: "user.identity_enabled",
        payload: {
          schemaVersion: 1,
          subjectId: "enabled",
          enabledAt: "2026-08-04T00:00:00.000Z",
        },
      },
      {
        id: 5,
        eventType: "user.identity_merged",
        payload: {
          schemaVersion: 1,
          subjectId: "canonical",
          retiredSubjectId: "retired",
          mergedAt: "2026-08-05T00:00:00.000Z",
        },
      },
    ];
    const advanceCursor = vi.fn();
    const ctx = {
      projectorStateRepo: {
        ensureCursor: vi.fn(),
        getCursor: vi.fn().mockResolvedValue(0),
        advanceCursor,
        recordError: vi.fn(),
      },
      domainEventReader: { listAfterCursor: vi.fn().mockResolvedValue(rows) },
      transactionRunner: {
        runInTransaction: vi.fn(async (fn: (tx: object) => Promise<void>) => fn({})),
      },
    } as unknown as ProjectorRunContext;
    const log = { error: vi.fn() } as unknown as Parameters<
      typeof processBidProfileProvisioning
    >[0]["log"];

    await processBidProfileProvisioning({ ctx, log });

    expect(writeBidUserProfile).toHaveBeenNthCalledWith(1, {}, "email-changed", {
      emailStatus: "ok",
      emailStatusChangedAt: new Date("2026-08-01T00:00:00.000Z"),
    });
    expect(writeBidUserProfile).toHaveBeenNthCalledWith(2, {}, "disabled", {
      identityDisabledAt: new Date("2026-08-03T00:00:00.000Z"),
    });
    expect(writeBidUserProfile).toHaveBeenNthCalledWith(3, {}, "enabled", {
      identityDisabledAt: null,
    });
    expect(writeBidUserProfile).toHaveBeenNthCalledWith(4, {}, "retired", {
      identityDisabledAt: new Date("2026-08-05T00:00:00.000Z"),
      mergedIntoSubjectId: "canonical",
    });
    expect(writeBidUserProfile).toHaveBeenCalledTimes(4);
    expect(ensureBidUserProfile).not.toHaveBeenCalled();
    expect(advanceCursor).toHaveBeenCalledWith("bid_profile_provisioning", 5);
  });
});
