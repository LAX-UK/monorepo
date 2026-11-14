import { act, renderHook } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { sortRows, useSortedRows } from "./sort-rows.js";
import type { DataColumn } from "./types.js";

type Row = { id: string; amount: number | null };
const columns: DataColumn<Row>[] = [
  { id: "id", header: "ID", cell: (row) => row.id },
  {
    id: "amount",
    header: "Amount",
    cell: (row) => row.amount,
    sortable: true,
    sortValue: (row) => row.amount,
  },
];
const data: Row[] = [
  { id: "a", amount: 5 },
  { id: "b", amount: null },
  { id: "c", amount: 9 },
  { id: "d", amount: 5 },
];

describe("sortRows", () => {
  it("sorts like the table: ties keep their order, empty values last in both directions", () => {
    const ids = (rows: readonly Row[]) => rows.map((row) => row.id);
    expect(ids(sortRows(data, columns, { columnId: "amount", direction: "asc" }))).toEqual([
      "a",
      "d",
      "c",
      "b",
    ]);
    expect(ids(sortRows(data, columns, { columnId: "amount", direction: "desc" }))).toEqual([
      "c",
      "a",
      "d",
      "b",
    ]);
  });

  it("keeps the given order without a sort or a sortable column", () => {
    expect(sortRows(data, columns, null)).toBe(data);
    expect(sortRows(data, columns, { columnId: "id", direction: "asc" })).toBe(data);
  });
});

describe("useSortedRows", () => {
  it("starts from the default sort and follows the person's choice", () => {
    const { result } = renderHook(() =>
      useSortedRows({ data, columns, defaultSort: { columnId: "amount", direction: "desc" } }),
    );
    expect(result.current.rows[0]?.id).toBe("c");
    act(() => result.current.onSortChange({ columnId: "amount", direction: "asc" }));
    expect(result.current.rows[0]?.id).toBe("a");
    expect(result.current.sort).toEqual({ columnId: "amount", direction: "asc" });
  });
});
