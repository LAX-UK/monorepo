import { createHash } from "node:crypto";
import { bidSsfReplay, bidUserProfile } from "@auction/db";
import {
  type NormalizedSsfSignal,
  SSF_EVENT_TYPES,
  SSF_VERIFICATION_EVENT,
} from "@auction/identity-contracts";
import { describe, expect, it, vi } from "vitest";
import { StaleSsfSignalError } from "../services/interfaces/ssf-signal.js";
import { createBidSsfReplayStore, readOrderedSsfEventId } from "./drizzle-bid-ssf-receiver.js";

function orderedJti(subjectId: string, eventId: number, nonce: string): string {
  const subjectKey = createHash("sha256").update(subjectId).digest("base64url");
  return `lax-identity-outbox-v1.${subjectKey}.${eventId}.${nonce}`;
}

function signal(eventType: NormalizedSsfSignal["eventType"], jti: string): NormalizedSsfSignal {
  return {
    issuer: "https://auth.test",
    audience: "lax-bid-api",
    issuedAt: 1_786_000_000,
    jti,
    subjectId: "subject-1",
    eventType,
    event: {},
  };
}

function createDb() {
  const ledger = new Set<string>();
  const updates: unknown[] = [];
  const lockProfile = vi.fn().mockResolvedValue([{ userId: "subject-1" }]);
  const insert = vi.fn((table: unknown) => {
    expect(table).toBe(bidSsfReplay);
    return {
      values: ({ jti }: { jti: string }) => ({
        onConflictDoNothing: () => ({
          returning: async () => {
            if (ledger.has(jti)) return [];
            ledger.add(jti);
            return [{ jti }];
          },
        }),
      }),
    };
  });
  const select = vi.fn((_fields: unknown) => ({
    from: (table: unknown) => {
      if (table === bidUserProfile) {
        return { where: () => ({ for: lockProfile }) };
      }
      expect(table).toBe(bidSsfReplay);
      return {
        where: async () => [...ledger].map((jti) => ({ jti })),
      };
    },
  }));
  const update = vi.fn((table: unknown) => {
    expect(table).toBe(bidUserProfile);
    return {
      set: (patch: unknown) => {
        updates.push(patch);
        return { where: vi.fn().mockResolvedValue(undefined) };
      },
    };
  });
  const tx = { insert, select, update };
  const transaction = vi.fn(async (work: (value: typeof tx) => Promise<unknown>) => work(tx));
  return {
    db: { transaction } as never,
    ledger,
    updates,
    lockProfile,
  };
}

const expiresAt = new Date("2026-08-28T20:05:00.000Z");

describe("Bid SSF monotonic lifecycle projection", () => {
  it("keeps a newer disable when an older enable arrives later", async () => {
    const { db, updates, lockProfile } = createDb();
    const replay = createBidSsfReplayStore(db);

    await expect(
      replay.consume(
        signal(SSF_EVENT_TYPES.ACCOUNT_DISABLED, orderedJti("subject-1", 12, "newer")),
        expiresAt,
      ),
    ).resolves.toBe(true);
    await expect(
      replay.consume(
        signal(SSF_EVENT_TYPES.ACCOUNT_ENABLED, orderedJti("subject-1", 11, "older")),
        expiresAt,
      ),
    ).rejects.toBeInstanceOf(StaleSsfSignalError);

    expect(updates).toHaveLength(1);
    expect(lockProfile).toHaveBeenCalledTimes(2);
    expect(lockProfile).toHaveBeenCalledWith("update");
  });

  it("keeps a newer enable when an older disable retry arrives later", async () => {
    const { db, updates } = createDb();
    const replay = createBidSsfReplayStore(db);

    await expect(
      replay.consume(
        signal(SSF_EVENT_TYPES.ACCOUNT_ENABLED, orderedJti("subject-1", 12, "newer")),
        expiresAt,
      ),
    ).resolves.toBe(true);
    await expect(
      replay.consume(
        signal(SSF_EVENT_TYPES.ACCOUNT_DISABLED, orderedJti("subject-1", 11, "older")),
        expiresAt,
      ),
    ).rejects.toBeInstanceOf(StaleSsfSignalError);

    expect(updates).toEqual([expect.objectContaining({ identityDisabledAt: null })]);
  });

  it("applies lifecycle events that arrive in durable outbox order", async () => {
    const { db, updates } = createDb();
    const replay = createBidSsfReplayStore(db);

    await replay.consume(
      signal(SSF_EVENT_TYPES.ACCOUNT_DISABLED, orderedJti("subject-1", 11, "first")),
      expiresAt,
    );
    await replay.consume(
      signal(SSF_EVENT_TYPES.ACCOUNT_ENABLED, orderedJti("subject-1", 12, "second")),
      expiresAt,
    );

    expect(updates).toHaveLength(2);
    expect(updates[1]).toMatchObject({ identityDisabledAt: null });
  });

  it("reserves a stale ordered SET so retries remain replay-safe", async () => {
    const { db, ledger, updates } = createDb();
    const replay = createBidSsfReplayStore(db);
    const newer = signal(SSF_EVENT_TYPES.ACCOUNT_DISABLED, orderedJti("subject-1", 12, "newer"));
    const stale = signal(SSF_EVENT_TYPES.ACCOUNT_ENABLED, orderedJti("subject-1", 11, "stale"));

    await expect(replay.consume(newer, expiresAt)).resolves.toBe(true);
    await expect(replay.consume(stale, expiresAt)).rejects.toBeInstanceOf(StaleSsfSignalError);
    await expect(replay.consume(stale, expiresAt)).resolves.toBe(false);

    expect(ledger.size).toBe(2);
    expect(updates).toHaveLength(1);
  });

  it("fails closed for a pre-ordering enable SET", async () => {
    const { db, updates } = createDb();
    const replay = createBidSsfReplayStore(db);

    await expect(
      replay.consume(signal(SSF_EVENT_TYPES.ACCOUNT_ENABLED, "legacy-jti"), expiresAt),
    ).rejects.toBeInstanceOf(StaleSsfSignalError);

    expect(updates).toHaveLength(0);
  });

  it("does not require ordering metadata for non-lifecycle signals", async () => {
    const { db, lockProfile, updates } = createDb();
    const replay = createBidSsfReplayStore(db);

    await expect(
      replay.consume(signal(SSF_VERIFICATION_EVENT, "verification-jti"), expiresAt),
    ).resolves.toBe(true);

    expect(lockProfile).not.toHaveBeenCalled();
    expect(updates).toHaveLength(0);
  });
});

describe("readOrderedSsfEventId", () => {
  it("accepts only the matching subject and a positive safe event ID", () => {
    const jti = orderedJti("subject-1", 42, "nonce");
    expect(readOrderedSsfEventId(jti, "subject-1")).toBe(42);
    expect(readOrderedSsfEventId(jti, "subject-2")).toBeNull();
    expect(readOrderedSsfEventId(orderedJti("subject-1", 0, "nonce"), "subject-1")).toBeNull();
  });
});
