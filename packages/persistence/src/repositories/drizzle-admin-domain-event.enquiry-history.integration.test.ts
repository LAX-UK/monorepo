import { randomUUID } from "node:crypto";
import { createDb } from "@auction/db";
import { bidIdentityDirectory, domainEvent } from "@auction/db/schema";
import { describe, expect, it } from "vitest";
import { DrizzleAdminDomainEventReader } from "./drizzle-admin-domain-event.reader.js";

const HAS_DB = Boolean(process.env.DATABASE_URL);
const base = Date.UTC(2026, 5, 1, 9, 0, 0);
const at = (minutes: number) => new Date(base + minutes * 60_000);

/**
 * An enquiry's history must keep its newest changes however many times its files were opened.
 * Runs in a transaction that is rolled back.
 */
describe.skipIf(!HAS_DB)("enquiry history reads (integration)", () => {
  it("keeps a reassignment and a closure that come after more than 200 attachment views", async () => {
    // biome-ignore lint/style/noNonNullAssertion: gated by HAS_DB
    const db = createDb(process.env.DATABASE_URL!);
    const rollback = new Error("rollback_test_tx");
    const aggregateId = randomUUID();
    const staffId = `staff-${randomUUID().slice(0, 8)}`;
    try {
      await db.transaction(async (tx) => {
        const row = (eventType: string, minutes: number, payload: object = {}) => ({
          aggregateType: "marketing_enquiry",
          aggregateId,
          eventType,
          payload,
          producer: "integration-test",
          occurredAt: at(minutes),
        });
        await tx
          .insert(domainEvent)
          .values([
            row("marketing_enquiry.assigned", 0, { assignedToUserId: staffId }),
            ...Array.from({ length: 250 }, (_, i) =>
              row("marketing_enquiry.attachment_viewed", 1 + i),
            ),
            row("marketing_enquiry.assigned", 500, { assignedToUserId: "other" }),
            row("marketing_enquiry.status_changed", 501, { from: "new", to: "closed" }),
          ]);
        await tx.insert(bidIdentityDirectory).values({
          subjectId: staffId,
          email: `${staffId}@example.com`,
          name: "Seed Staffer",
          identityCreatedAt: at(0),
        });
        const reader = new DrizzleAdminDomainEventReader(tx as never);
        const wanted = [
          "marketing_enquiry.assigned",
          "marketing_enquiry.status_changed",
          "marketing_enquiry.converted",
        ];

        // Unfiltered, 200 newest-first rows are all views: the cut the review found.
        const rawOldestFirst = await reader.listRedacted({
          aggregateType: "marketing_enquiry",
          aggregateId,
          limit: 200,
          includePii: false,
        });
        expect(rawOldestFirst.some((e) => e.eventType === "marketing_enquiry.status_changed")).toBe(
          false,
        );

        const events = await reader.listRedacted({
          aggregateType: "marketing_enquiry",
          aggregateId,
          eventTypes: wanted,
          newestFirst: true,
          limit: 200,
          includePii: false,
        });
        expect(events.map((e) => e.eventType)).toEqual([
          "marketing_enquiry.status_changed",
          "marketing_enquiry.assigned",
          "marketing_enquiry.assigned",
        ]);

        // Even a tight limit drops the oldest change, never the newest.
        const tight = await reader.listRedacted({
          aggregateType: "marketing_enquiry",
          aggregateId,
          eventTypes: wanted,
          newestFirst: true,
          limit: 2,
          includePii: false,
        });
        expect(tight.map((e) => e.eventType)).toEqual([
          "marketing_enquiry.status_changed",
          "marketing_enquiry.assigned",
        ]);

        const names = await reader.actorNames([staffId, "nobody"]);
        expect(names.get(staffId)).toBe("Seed Staffer");
        expect(names.has("nobody")).toBe(false);
        expect((await reader.actorNames([])).size).toBe(0);
        throw rollback;
      });
    } catch (error) {
      if (error !== rollback) throw error;
    }
  });
});
