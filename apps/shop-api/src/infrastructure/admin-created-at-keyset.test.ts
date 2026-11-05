import { shopOrder } from "@auction/db/schema";
import { PgDialect } from "drizzle-orm/pg-core";
import { describe, expect, it } from "vitest";
import {
  createdAtMicros,
  keysetAfterRaw,
  keysetBeforeCreatedAtId,
  msTimestamp,
  orderByRawTimestampId,
} from "./admin-created-at-keyset.js";

const dialect = new PgDialect();
const ID = "00000000-0000-4000-8000-000000000003";

describe("raw-column keyset paging (index-friendly)", () => {
  const cursor = {
    createdAt: new Date("2024-06-01T12:00:00.123Z"),
    createdAtMicros: "2024-06-01T12:00:00.123456Z",
    id: ID,
  };

  it("compares (created_at, id) as one row value with the full-precision cursor", () => {
    const q = dialect.sqlToQuery(keysetAfterRaw(shopOrder.createdAt, shopOrder.id, cursor, "desc"));
    expect(q.sql).toBe(
      '("shop_order"."created_at", "shop_order"."id") < ($1::timestamptz, $2::uuid)',
    );
    expect(q.params).toEqual([cursor.createdAtMicros, ID]);
    expect(q.sql).not.toContain("date_trunc");
  });

  it("uses > for ascending lists", () => {
    const q = dialect.sqlToQuery(keysetAfterRaw(shopOrder.createdAt, shopOrder.id, cursor, "asc"));
    expect(q.sql).toContain(") > (");
  });

  it("falls back to the millisecond value for a cursor without microseconds", () => {
    const q = dialect.sqlToQuery(
      keysetAfterRaw(
        shopOrder.createdAt,
        shopOrder.id,
        { createdAt: cursor.createdAt, id: ID },
        "desc",
      ),
    );
    expect(q.params[0]).toBe("2024-06-01T12:00:00.123Z");
  });

  it("orders by the bare columns, never an expression", () => {
    const [at, id] = orderByRawTimestampId(shopOrder.createdAt, shopOrder.id, "desc");
    expect(dialect.sqlToQuery(at).sql).toBe('"shop_order"."created_at" desc');
    expect(dialect.sqlToQuery(id).sql).toBe('"shop_order"."id" desc');
  });

  it("selects the position to the microsecond in UTC", () => {
    const q = dialect.sqlToQuery(createdAtMicros(shopOrder.createdAt));
    expect(q.sql).toContain("AT TIME ZONE 'UTC'");
    expect(q.sql).toContain("SS.US");
  });
});

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
