import { randomUUID } from "node:crypto";
import { createDb } from "@auction/db";
import { domainEvent } from "@auction/db/schema";
import { describe, expect, it } from "vitest";
import { DrizzleAdminDomainEventReader } from "./drizzle-admin-domain-event.reader.js";

const HAS_DB = Boolean(process.env.DATABASE_URL);

const hour = 3_600_000;
const base = Date.UTC(2026, 5, 1, 9, 0, 0);
const at = (hours: number) => new Date(base + hours * hour);

/**
 * The staff Audit log lists newest first unless asked for oldest first, and events that happened
 * at the same moment keep one order, by event id in the same direction, so pages never overlap.
 * Runs in a transaction that is rolled back.
 */
describe.skipIf(!HAS_DB)("audit log ordering (integration)", () => {
  async function inRollback(
    run: (ctx: {
      reader: DrizzleAdminDomainEventReader;
      aggregateType: string;
      first: number;
      second: number;
      third: number;
      tiedAscending: number[];
    }) => Promise<void>,
  ) {
    // biome-ignore lint/style/noNonNullAssertion: gated by HAS_DB
    const db = createDb(process.env.DATABASE_URL!);
    const rollback = new Error("rollback_test_tx");
    const aggregateType = `order_test_${randomUUID().slice(0, 8)}`;
    try {
      await db.transaction(async (tx) => {
        // Inserted out of time order, so the insertion order is not what the list shows. The two
        // events at 30 hours tie on time.
        const events = [
          { key: "third", hours: 20 },
          { key: "tie-1", hours: 30 },
          { key: "first", hours: 0 },
          { key: "tie-2", hours: 30 },
          { key: "second", hours: 10 },
        ];
        const ids: Record<string, number> = {};
        for (const event of events) {
          const [row] = await tx
            .insert(domainEvent)
            .values({
              aggregateType,
              aggregateId: `${aggregateType}-${event.key}`,
              eventType: "integration.ordering_checked",
              payload: {},
              producer: "integration-test",
              occurredAt: at(event.hours),
            })
            .returning({ id: domainEvent.id });
          ids[event.key] = (row as { id: number }).id;
        }

        await run({
          reader: new DrizzleAdminDomainEventReader(tx),
          aggregateType,
          first: ids.first as number,
          second: ids.second as number,
          third: ids.third as number,
          tiedAscending: [ids["tie-1"] as number, ids["tie-2"] as number].sort((a, b) => a - b),
        });
        throw rollback;
      });
    } catch (error) {
      if (error !== rollback) throw error;
    }
  }

  it("lists newest first when no sort is given, and for at_desc, ties by event id descending", async () => {
    await inRollback(async ({ reader, aggregateType, first, second, third, tiedAscending }) => {
      const expected = [...[...tiedAscending].reverse(), third, second, first];
      const byDefault = await reader.searchAuditLog({ limit: 50, offset: 0, aggregateType });
      expect(byDefault.rows.map((row) => row.id)).toEqual(expected);
      expect(byDefault.total).toBe(5);
      const explicit = await reader.searchAuditLog({
        limit: 50,
        offset: 0,
        aggregateType,
        sort: "at_desc",
      });
      expect(explicit.rows.map((row) => row.id)).toEqual(expected);
    });
  });

  it("lists oldest first for at_asc, ties by event id ascending", async () => {
    await inRollback(async ({ reader, aggregateType, first, second, third, tiedAscending }) => {
      const result = await reader.searchAuditLog({
        limit: 50,
        offset: 0,
        aggregateType,
        sort: "at_asc",
      });
      expect(result.rows.map((row) => row.id)).toEqual([first, second, third, ...tiedAscending]);
    });
  });

  it("pages through each order without repeating or skipping an event", async () => {
    await inRollback(async ({ reader, aggregateType }) => {
      for (const sort of ["at_desc", "at_asc"] as const) {
        const whole = await reader.searchAuditLog({ limit: 50, offset: 0, aggregateType, sort });
        const paged: number[] = [];
        for (let offset = 0; offset < whole.rows.length; offset += 2) {
          const page = await reader.searchAuditLog({ limit: 2, offset, aggregateType, sort });
          paged.push(...page.rows.map((row) => row.id));
        }
        expect(paged, sort).toEqual(whole.rows.map((row) => row.id));
      }
    });
  });
});
