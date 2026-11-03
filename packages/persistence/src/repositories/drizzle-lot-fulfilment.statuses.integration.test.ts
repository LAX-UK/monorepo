import { createDb } from "@auction/db";
import { lot, lotFulfilment } from "@auction/db/schema";
import { eq, notInArray } from "drizzle-orm";
import { afterAll, describe, expect, it } from "vitest";
import { DrizzleLotFulfilmentRepository } from "./drizzle-lot-fulfilment.repository.js";

const HAS_DB = Boolean(process.env.DATABASE_URL);

describe.skipIf(!HAS_DB)("lot fulfilment statuses (integration)", () => {
  // biome-ignore lint/style/noNonNullAssertion: gated by HAS_DB
  const db = createDb(process.env.DATABASE_URL!);
  const repo = new DrizzleLotFulfilmentRepository(db);
  const created: string[] = [];

  afterAll(async () => {
    for (const id of created) await db.delete(lotFulfilment).where(eq(lotFulfilment.lotId, id));
  });

  it("returns the status of the lots that have a record and leaves the others out", async () => {
    const withRecord = (await db.select({ id: lotFulfilment.lotId }).from(lotFulfilment)).map(
      (row) => row.id,
    );
    const lots = await db
      .select({ id: lot.id })
      .from(lot)
      .where(withRecord.length > 0 ? notInArray(lot.id, withRecord) : undefined)
      .limit(2);
    const [cancelledLot, bareLot] = lots;
    if (!cancelledLot || !bareLot) return;
    await repo.insert({ lotId: cancelledLot.id, paymentId: null, status: "cancelled" } as never);
    created.push(cancelledLot.id);

    const statuses = await repo.statusesForLots([cancelledLot.id, bareLot.id]);
    expect(statuses.get(cancelledLot.id)).toBe("cancelled");
    expect(statuses.has(bareLot.id)).toBe(false);
    expect((await repo.statusesForLots([])).size).toBe(0);
  });
});
