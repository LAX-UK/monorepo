import {
  SUBJECT_EXPORT_MAX_PAGE_BYTES,
  SUBJECT_EXPORT_MAX_PAGE_RECORDS,
  type SubjectExportPage,
  type SubjectExportRecord,
} from "@auction/identity-contracts";
import {
  InvalidSubjectExportCursorError,
  type SubjectExportCategory,
} from "./subject-export.types.js";

/** Room left for the page envelope (`records` wrapper and cursor) inside the byte cap. */
const PAGE_ENVELOPE_RESERVE_BYTES = 4 * 1024;
const PAGE_RECORD_BUDGET_BYTES = SUBJECT_EXPORT_MAX_PAGE_BYTES - PAGE_ENVELOPE_RESERVE_BYTES;

/** A record and the key it is ordered and resumed by within its source. */
export type SourceRow = { key: string; record: SubjectExportRecord };

/**
 * One table (or small set of rows) a category reads. Rows come back in ascending `key` order, so a
 * page can resume after the last key it returned.
 */
export interface ExportSource {
  count(subjectId: string): Promise<number>;
  page(subjectId: string, afterKey: string | null, limit: number): Promise<SourceRow[]>;
}

/** A source for a small, bounded set of rows that is cheaper to load whole than to page in SQL. */
export function inMemorySource(load: (subjectId: string) => Promise<SourceRow[]>): ExportSource {
  const sorted = async (subjectId: string) =>
    (await load(subjectId)).sort((a, b) => (a.key < b.key ? -1 : a.key > b.key ? 1 : 0));
  return {
    async count(subjectId) {
      return (await load(subjectId)).length;
    },
    async page(subjectId, afterKey, limit) {
      const rows = await sorted(subjectId);
      const start = afterKey === null ? 0 : rows.findIndex((row) => row.key > afterKey);
      if (start < 0) return [];
      return rows.slice(start, start + limit);
    },
  };
}

type Cursor = { s: number; a: string | null };

function encodeCursor(cursor: Cursor): string {
  return Buffer.from(JSON.stringify(cursor), "utf8").toString("base64url");
}

function decodeCursor(raw: string, sourceCount: number): Cursor {
  try {
    const parsed: unknown = JSON.parse(Buffer.from(raw, "base64url").toString("utf8"));
    if (
      typeof parsed === "object" &&
      parsed !== null &&
      "s" in parsed &&
      "a" in parsed &&
      Number.isInteger(parsed.s) &&
      (parsed.s as number) >= 0 &&
      (parsed.s as number) < sourceCount &&
      (parsed.a === null || typeof parsed.a === "string")
    ) {
      return { s: parsed.s as number, a: parsed.a as string | null };
    }
  } catch {
    // fall through to the typed error
  }
  throw new InvalidSubjectExportCursorError();
}

const jsonBytes = (record: SubjectExportRecord) =>
  Buffer.byteLength(JSON.stringify(record), "utf8");

/**
 * A category made of one or more ordered sources. It owns the paging rules every category shares:
 * an opaque cursor, at most the contract's record count per page, and the page byte cap. A single
 * record larger than the cap is still returned alone, because dropping it would drop the person's data.
 */
export abstract class SourcedExportCategory implements SubjectExportCategory {
  abstract readonly id: string;
  protected abstract readonly sources: readonly ExportSource[];

  async count(subjectId: string): Promise<number> {
    const counts = await Promise.all(this.sources.map((source) => source.count(subjectId)));
    return counts.reduce((sum, n) => sum + n, 0);
  }

  async readPage(subjectId: string, cursor: string | null): Promise<SubjectExportPage> {
    const start = cursor ? decodeCursor(cursor, this.sources.length) : { s: 0, a: null };
    let { s: sourceIndex, a: afterKey } = start;
    const records: SubjectExportRecord[] = [];
    let bytes = 0;

    while (sourceIndex < this.sources.length && records.length < SUBJECT_EXPORT_MAX_PAGE_RECORDS) {
      const source = this.sources[sourceIndex] as ExportSource;
      const want = SUBJECT_EXPORT_MAX_PAGE_RECORDS - records.length;
      const rows = await source.page(subjectId, afterKey, want);
      for (const row of rows) {
        const size = jsonBytes(row.record);
        if (records.length > 0 && bytes + size > PAGE_RECORD_BUDGET_BYTES) {
          return { records, nextCursor: encodeCursor({ s: sourceIndex, a: afterKey }) };
        }
        records.push(row.record);
        bytes += size;
        afterKey = row.key;
      }
      if (rows.length < want) {
        sourceIndex += 1;
        afterKey = null;
      }
    }

    return {
      records,
      nextCursor:
        sourceIndex < this.sources.length ? encodeCursor({ s: sourceIndex, a: afterKey }) : null,
    };
  }
}
