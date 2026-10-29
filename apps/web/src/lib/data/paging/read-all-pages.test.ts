import { describe, expect, it, vi } from "vitest";
import { readAllPages } from "./read-all-pages";

const list = (n: number) => Array.from({ length: n }, (_, i) => i);

function pagesOf(all: number[], withTotal = false) {
  return vi.fn(async ({ limit, offset }: { limit: number; offset: number }) => ({
    rows: all.slice(offset, offset + limit),
    ...(withTotal ? { total: all.length } : {}),
  }));
}

describe("readAllPages", () => {
  it("reads past the first page until the list ends", async () => {
    const load = pagesOf(list(250));
    const read = await readAllPages(load, { pageSize: 100, maxRows: 1000 });
    expect(read).toEqual({ rows: list(250), complete: true });
    expect(load).toHaveBeenCalledTimes(3);
  });

  it("stops on the total without asking for an empty page", async () => {
    const load = pagesOf(list(200), true);
    const read = await readAllPages(load, { pageSize: 100, maxRows: 1000 });
    expect(read.complete).toBe(true);
    expect(load).toHaveBeenCalledTimes(2);
  });

  it("says when a long list was cut at the bound, never silently", async () => {
    const read = await readAllPages(pagesOf(list(1500)), { pageSize: 100, maxRows: 1000 });
    expect(read.rows).toHaveLength(1000);
    expect(read.complete).toBe(false);
  });

  it("reads an empty list as complete", async () => {
    expect(await readAllPages(pagesOf([]), { pageSize: 100, maxRows: 1000 })).toEqual({
      rows: [],
      complete: true,
    });
  });
});
