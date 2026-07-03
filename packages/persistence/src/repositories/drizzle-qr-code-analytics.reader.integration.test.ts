import { randomUUID } from "node:crypto";
import { createDb } from "@auction/db";
import { qrCode, qrCodeScanDaily } from "@auction/db/schema";
import { describe, expect, it } from "vitest";
import { DrizzleQrCodeAnalyticsReader } from "./drizzle-qr-code-analytics.reader.js";

const HAS_DB = Boolean(process.env.DATABASE_URL);

describe.skipIf(!HAS_DB)("DrizzleQrCodeAnalyticsReader (integration)", () => {
  it("fetchDailyAggregates sums daily rollups for a QR code", async () => {
    // biome-ignore lint/style/noNonNullAssertion: gated by HAS_DB
    const db = createDb(process.env.DATABASE_URL!);
    const rollback = new Error("rollback_test_tx");
    const suffix = randomUUID().slice(0, 8);
    const entityId = randomUUID();
    const day = new Date("2026-06-12T00:00:00.000Z");

    try {
      await db.transaction(async (tx) => {
        const [code] = await tx
          .insert(qrCode)
          .values({
            shortCode: `t-${suffix}`,
            entityType: "sale",
            entityId,
          })
          .returning({ id: qrCode.id });
        if (!code) throw new Error("expected qr code row");

        await tx.insert(qrCodeScanDaily).values({
          qrCodeId: code.id,
          day,
          country: "GB",
          deviceType: "mobile",
          scans: 7,
        });

        const reader = new DrizzleQrCodeAnalyticsReader(tx);
        const result = await reader.fetchDailyAggregates(code.id, {
          from: new Date("2026-06-07T00:00:00.000Z"),
          to: new Date("2026-06-13T15:00:00.000Z"),
        });

        expect(result.total).toBe(7);
        expect(result.trend.some((row) => row.scans === 7)).toBe(true);
        expect(result.device[0]?.key).toBe("mobile");

        throw rollback;
      });
    } catch (e) {
      if (e !== rollback) throw e;
    }
  });
});
