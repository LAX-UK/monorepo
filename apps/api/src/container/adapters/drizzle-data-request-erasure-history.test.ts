import type { Database } from "@auction/db";
import { describe, expect, it } from "vitest";
import { DrizzleDataRequestErasureHistory } from "./drizzle-data-request-erasure-history.js";

function fakeDb(rows: unknown[]) {
  const chain = {
    from: () => chain,
    leftJoin: () => chain,
    where: () => chain,
    orderBy: async () => rows,
  };
  return { select: () => chain } as unknown as Database;
}

describe("DrizzleDataRequestErasureHistory", () => {
  it("returns each erasure's time, actor name and enquiry count", async () => {
    const at = new Date("2026-11-02T10:00:00.000Z");
    const history = new DrizzleDataRequestErasureHistory(
      fakeDb([
        { at, payload: { enquiries: 3, requestReference: "DR-0007" }, actorName: "Hana Ito" },
        { at, payload: { requestReference: "DR-0007" }, actorName: null },
      ]),
    );
    expect(await history.forReference("DR-0007")).toEqual([
      { at, actorName: "Hana Ito", enquiries: 3 },
      { at, actorName: null, enquiries: 0 },
    ]);
  });
});
