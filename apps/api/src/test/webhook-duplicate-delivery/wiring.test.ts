import { describe, expect, it } from "vitest";
import { claimGatedRunner } from "../claim-gated-runner.js";
import { connectCases } from "./connect.cases.js";
import { identityCases } from "./identity.cases.js";
import { settlementCases } from "./settlement.cases.js";
import { stripePaymentCases } from "./stripe-payment.cases.js";

// Runs every case without a database, against an in-memory claims table that makes a second claim
// wait for the first transaction to end, as Postgres does. It checks that each case is wired to
// its handler and its effect; the integration test runs the same cases against the real table.
function fakeBase() {
  const committed = new Set<string>();
  const holders = new Map<string, Promise<void>>();
  return {
    runInTransaction: async (fn: (tx: unknown) => Promise<unknown>) => {
      const mine: string[] = [];
      let done!: () => void;
      const finished = new Promise<void>((r) => {
        done = r;
      });
      const tx = {
        insert: () => ({
          values: (v: { eventId: string }) => ({
            onConflictDoNothing: () => ({
              returning: async () => {
                while (holders.has(v.eventId) && !mine.includes(v.eventId))
                  await holders.get(v.eventId);
                if (committed.has(v.eventId)) return [];
                holders.set(v.eventId, finished);
                mine.push(v.eventId);
                return [{ eventId: v.eventId }];
              },
            }),
          }),
        }),
      };
      try {
        const r = await fn(tx);
        for (const id of mine) committed.add(id);
        return r;
      } finally {
        for (const id of mine) holders.delete(id);
        done();
      }
    },
  };
}

const CASES = [...stripePaymentCases, ...connectCases, ...identityCases, ...settlementCases];

describe.each(CASES)("$name is wired for the duplicate-delivery tests", (handler) => {
  it("is taken over by the second delivery when the first fails", async () => {
    const gate = claimGatedRunner(fakeBase() as never, "fail");
    const { deliver, effect } = handler.build("e1", gate.runner, null);
    const first = deliver().then(
      () => null,
      (error: unknown) => error,
    );
    await gate.claimed;
    const second = deliver();
    await new Promise((r) => setTimeout(r, 20));
    expect(effect).not.toHaveBeenCalled();
    gate.release();
    expect(await first).toEqual(new Error("injected failure after the claim"));
    await second;
    expect(effect).toHaveBeenCalledTimes(1);
  });
  it("is a duplicate for the second delivery once the first commits", async () => {
    const gate = claimGatedRunner(fakeBase() as never, "pass");
    const { deliver, effect, isDuplicate } = handler.build("e2", gate.runner, null);
    const first = deliver();
    await gate.claimed;
    const second = deliver();
    await new Promise((r) => setTimeout(r, 20));
    gate.release();
    const a = await first;
    const b = await second;
    if (isDuplicate) {
      expect(isDuplicate(a)).toBe(false);
      expect(isDuplicate(b)).toBe(true);
    }
    expect(effect).toHaveBeenCalledTimes(1);
  });
});
