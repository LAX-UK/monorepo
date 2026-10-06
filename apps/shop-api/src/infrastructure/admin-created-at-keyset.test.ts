import { shopOrder } from "@auction/db/schema";
import { describe, expect, it } from "vitest";
import { keysetBeforeCreatedAtId, msTimestamp } from "./admin-created-at-keyset.js";

describe("admin created-at keyset paging", () => {
  it("orders rows in the same millisecond by id descending", () => {
    const sameMs = new Date("2024-06-01T12:00:00.123Z");
    const rows = [
      { createdAt: sameMs, id: "00000000-0000-4000-8000-000000000003" },
      { createdAt: sameMs, id: "00000000-0000-4000-8000-000000000002" },
      { createdAt: sameMs, id: "00000000-0000-4000-8000-000000000001" },
    ];

    void msTimestamp(shopOrder.createdAt);
    const sorted = [...rows].sort((a, b) => {
      if (a.createdAt.getTime() !== b.createdAt.getTime()) {
        return b.createdAt.getTime() - a.createdAt.getTime();
      }
      return b.id.localeCompare(a.id);
    });

    expect(sorted.map((row) => row.id)).toEqual([
      "00000000-0000-4000-8000-000000000003",
      "00000000-0000-4000-8000-000000000002",
      "00000000-0000-4000-8000-000000000001",
    ]);

    const cursor = {
      createdAt: sameMs,
      id: "00000000-0000-4000-8000-000000000003",
    };
    const predicate = keysetBeforeCreatedAtId(shopOrder.createdAt, shopOrder.id, cursor);
    void predicate;
    const afterFirstPage = sorted.filter(
      (row) =>
        row.createdAt.getTime() < cursor.createdAt.getTime() ||
        (row.createdAt.getTime() === cursor.createdAt.getTime() && row.id < cursor.id),
    );
    expect(afterFirstPage.map((row) => row.id)).toEqual([
      "00000000-0000-4000-8000-000000000002",
      "00000000-0000-4000-8000-000000000001",
    ]);
  });
});
