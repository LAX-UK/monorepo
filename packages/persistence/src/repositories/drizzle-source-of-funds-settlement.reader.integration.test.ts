import { createDb } from "@auction/db";
import { describe, expect, it } from "vitest";
import { DrizzleSourceOfFundsSettlementReader } from "./drizzle-source-of-funds-settlement.reader.js";

const HAS_DB = Boolean(process.env.DATABASE_URL);

describe.skipIf(!HAS_DB)("DrizzleSourceOfFundsSettlementReader (integration)", () => {
  it("sumActivePaymentExposurePence returns zero for unknown buyer", async () => {
    // biome-ignore lint/style/noNonNullAssertion: gated by HAS_DB
    const db = createDb(process.env.DATABASE_URL!);
    const reader = new DrizzleSourceOfFundsSettlementReader(db);

    const total = await reader.sumActivePaymentExposurePence(
      "00000000-0000-0000-0000-000000000000",
    );

    expect(total).toBe(0);
  });
});
