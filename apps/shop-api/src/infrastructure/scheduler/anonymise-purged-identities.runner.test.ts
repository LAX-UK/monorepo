import type { Database } from "@auction/db";
import { beforeEach, describe, expect, it, vi } from "vitest";

const anonymise = vi.hoisted(() => vi.fn());
vi.mock("../identity-purge/anonymise-shop-personal-data.js", () => ({
  anonymiseShopPersonalData: anonymise,
}));

import {
  IDENTITY_PURGE_ACTOR,
  createAnonymisePurgedIdentitiesRunner,
} from "./anonymise-purged-identities.runner.js";

const now = new Date("2026-11-02T10:00:00.000Z");

function fakeDb(events: { id: number; payload: unknown }[], cursor = 0) {
  const inserts: { values: unknown }[] = [];
  const updates: unknown[] = [];
  const tx = {
    insert: vi.fn(() => ({
      values: (values: unknown) => {
        inserts.push({ values });
        return Promise.resolve();
      },
    })),
    update: vi.fn(() => ({
      set: (values: unknown) => ({
        where: () => {
          updates.push(values);
          return Promise.resolve();
        },
      }),
    })),
  };
  const selects = [[{ cursor }], events];
  const db = {
    insert: vi.fn(() => ({ values: () => ({ onConflictDoNothing: () => Promise.resolve() }) })),
    select: vi.fn(() => {
      const answer = selects.shift() ?? [];
      const chain: Record<string, unknown> = {};
      chain.from = () => chain;
      chain.where = () => chain;
      chain.orderBy = () => chain;
      chain.limit = () => Promise.resolve(answer);
      return chain;
    }),
    transaction: vi.fn(async (fn: (t: unknown) => Promise<void>) => fn(tx)),
  };
  return { db: db as unknown as Database, inserts, updates };
}

beforeEach(() => {
  anonymise.mockReset();
  anonymise.mockResolvedValue({ shop_order: 1 });
});

const deleted = (subjectId: string) => ({
  schemaVersion: 1,
  subjectId,
  deletedAt: now.toISOString(),
});

describe("createAnonymisePurgedIdentitiesRunner", () => {
  it("anonymises each purged person, audits it and moves the cursor in one transaction", async () => {
    const { db, inserts, updates } = fakeDb([{ id: 11, payload: deleted("user_1") }]);
    const result = await createAnonymisePurgedIdentitiesRunner(db, { domainEventMode: "off" })(now);
    expect(result).toEqual({ processed: 1 });
    expect(anonymise).toHaveBeenCalledWith(expect.anything(), "user_1", now);
    expect(inserts).toHaveLength(2);
    expect(inserts[0]?.values).toMatchObject({
      actorSubjectId: IDENTITY_PURGE_ACTOR,
      action: "anonymise_purged_identity",
      targetId: "user_1",
      afterJson: JSON.stringify({ tables: { shop_order: 1 } }),
    });
    expect(inserts[1]?.values).toMatchObject({
      eventType: "shop.user_anonymised",
      aggregateId: "user_1",
      producer: "shop-api",
      payload: {
        schemaVersion: 1,
        subjectId: "user_1",
        product: "shop",
        anonymisedAt: now.toISOString(),
        tables: { shop_order: 1 },
      },
    });
    expect(updates).toEqual([expect.objectContaining({ lastEventId: 11 })]);
  });

  it("does nothing when no one has been purged", async () => {
    const { db, inserts } = fakeDb([]);
    const result = await createAnonymisePurgedIdentitiesRunner(db, { domainEventMode: "off" })(now);
    expect(result).toEqual({ processed: 0 });
    expect(inserts).toEqual([]);
    expect(anonymise).not.toHaveBeenCalled();
  });

  it("leaves the cursor where it was when anonymising fails", async () => {
    anonymise.mockRejectedValueOnce(new Error("db down"));
    const { db, updates } = fakeDb([{ id: 11, payload: deleted("user_1") }]);
    await expect(
      createAnonymisePurgedIdentitiesRunner(db, { domainEventMode: "off" })(now),
    ).rejects.toThrow("db down");
    expect(updates).toEqual([]);
  });
});
