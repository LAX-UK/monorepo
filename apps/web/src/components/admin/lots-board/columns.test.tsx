import { describe, expect, it } from "vitest";
import { lotColumns } from "./columns";

describe("lotColumns", () => {
  it("includes sale and estimate columns", () => {
    const columns = lotColumns();
    const ids = columns.map(
      (column) => column.id ?? ("accessorKey" in column ? column.accessorKey : ""),
    );
    expect(ids).toContain("sale");
    expect(ids).toContain("estimate");
  });
});
