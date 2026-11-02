import {
  SUBJECT_EXPORT_MAX_PAGE_BYTES,
  SUBJECT_EXPORT_MAX_PAGE_RECORDS,
} from "@auction/identity-contracts";
import { describe, expect, it } from "vitest";
import {
  type ExportSource,
  type SourceRow,
  SourcedExportCategory,
  inMemorySource,
} from "./sourced-export-category.js";
import { InvalidSubjectExportCursorError } from "./subject-export.types.js";

const rows = (prefix: string, n: number, pad = 0): SourceRow[] =>
  Array.from({ length: n }, (_, i) => {
    const key = `${prefix}${String(i).padStart(5, "0")}`;
    return { key, record: { id: key, origin: "provided" as const, pad: "x".repeat(pad) } };
  });

class TestCategory extends SourcedExportCategory {
  readonly id = "test";
  constructor(protected readonly sources: readonly ExportSource[]) {
    super();
  }
}

async function readAll(category: TestCategory) {
  const pages = [];
  let cursor: string | null = null;
  do {
    const page = await category.readPage("s", cursor);
    pages.push(page);
    cursor = page.nextCursor;
  } while (cursor);
  return pages;
}

describe("SourcedExportCategory", () => {
  it("returns nothing, and no cursor, for a person with no records", async () => {
    const category = new TestCategory([inMemorySource(async () => [])]);
    expect(await category.readPage("s", null)).toEqual({ records: [], nextCursor: null });
    expect(await category.count("s")).toBe(0);
  });

  it("caps a page at the contract's record count and resumes with the cursor", async () => {
    const category = new TestCategory([inMemorySource(async () => rows("a", 1200))]);
    const pages = await readAll(category);
    expect(pages.map((p) => p.records.length)).toEqual([
      SUBJECT_EXPORT_MAX_PAGE_RECORDS,
      SUBJECT_EXPORT_MAX_PAGE_RECORDS,
      200,
    ]);
    const ids = pages.flatMap((p) => p.records.map((r) => r.id));
    expect(new Set(ids).size).toBe(1200);
    expect(await category.count("s")).toBe(1200);
  });

  it("keeps a page under the byte cap and loses no record", async () => {
    const category = new TestCategory([inMemorySource(async () => rows("a", 300, 10_000))]);
    const pages = await readAll(category);
    for (const page of pages) {
      expect(Buffer.byteLength(JSON.stringify(page), "utf8")).toBeLessThanOrEqual(
        SUBJECT_EXPORT_MAX_PAGE_BYTES,
      );
    }
    expect(pages.flatMap((p) => p.records).map((r) => r.id)).toEqual(
      rows("a", 300).map((r) => r.key),
    );
  });

  it("still returns a single record larger than the cap, alone", async () => {
    const category = new TestCategory([inMemorySource(async () => rows("a", 2, 2 * 1024 * 1024))]);
    const pages = await readAll(category);
    expect(pages.map((p) => p.records.length)).toEqual([1, 1]);
  });

  it("walks several sources in order across page boundaries", async () => {
    const category = new TestCategory([
      inMemorySource(async () => rows("a", 3)),
      inMemorySource(async () => []),
      inMemorySource(async () => rows("c", 2)),
    ]);
    const ids = (await readAll(category)).flatMap((p) => p.records.map((r) => r.id));
    expect(ids).toEqual(["a00000", "a00001", "a00002", "c00000", "c00001"]);
    expect(await category.count("s")).toBe(5);
  });

  it("rejects a cursor it did not issue", async () => {
    const category = new TestCategory([inMemorySource(async () => rows("a", 1))]);
    for (const bad of ["not-a-cursor", Buffer.from('{"s":9,"a":null}').toString("base64url")]) {
      await expect(category.readPage("s", bad)).rejects.toBeInstanceOf(
        InvalidSubjectExportCursorError,
      );
    }
  });

  it("never gives the person's data to another subject's call", async () => {
    const seen: string[] = [];
    const category = new TestCategory([
      inMemorySource(async (subject) => {
        seen.push(subject);
        return subject === "alice" ? rows("a", 1) : [];
      }),
    ]);
    expect((await category.readPage("bob", null)).records).toEqual([]);
    expect(seen).toEqual(["bob"]);
  });
});
