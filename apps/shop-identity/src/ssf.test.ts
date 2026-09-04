import { type NormalizedSsfSignal, SSF_EVENT_TYPES } from "@auction/identity-contracts";
import type { Pool } from "pg";
import { describe, expect, it } from "vitest";
import { createPgShopSsfRepository } from "./db/shop-ssf.repository.js";

describe("Shop SSF atomic replay consumption", () => {
  it.each([
    [SSF_EVENT_TYPES.ACCOUNT_DISABLED, {}],
    [SSF_EVENT_TYPES.ACCOUNT_ENABLED, {}],
    [SSF_EVENT_TYPES.LAX_IDENTITY_MERGED, { canonical_subject_id: "subject-2" }],
  ] as const)("applies %s once and rejects replay", async (eventType, event) => {
    let replayInserted = false;
    let profileUpdates = 0;
    const client = {
      query: async (statement: string) => {
        if (statement.includes("insert into shop_ssf_replay")) {
          if (replayInserted) return { rowCount: 0 };
          replayInserted = true;
          return { rowCount: 1 };
        }
        if (statement.includes("update shop_user_profile")) profileUpdates += 1;
        return { rowCount: 0 };
      },
      release: () => undefined,
    };
    const pool = { connect: async () => client } as unknown as Pool;
    const store = createPgShopSsfRepository(pool);
    const signal: NormalizedSsfSignal = {
      issuer: "https://auth.lax.bid",
      audience: "lax-shop-api",
      issuedAt: 1_786_600_000,
      jti: "set-1",
      subjectId: "subject-1",
      eventType,
      event,
    };

    await expect(store.consume(signal, new Date("2026-08-13T06:10:00Z"))).resolves.toBe(true);
    await expect(store.consume(signal, new Date("2026-08-13T06:10:00Z"))).resolves.toBe(false);
    expect(profileUpdates).toBe(1);
  });
});
