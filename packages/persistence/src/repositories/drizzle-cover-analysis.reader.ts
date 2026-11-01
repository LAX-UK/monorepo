import type { Database } from "@auction/db";
import { coverAnalysis } from "@auction/db/schema";
import type { CoverAnalysisStatus } from "@auction/types";
import { inArray } from "drizzle-orm";
import type {
  CoverAnalysisRecord,
  ICoverAnalysisReader,
} from "../interfaces/cover-analysis.reader.js";

function isUndefinedTableError(error: unknown): boolean {
  if (typeof error !== "object" || error === null) return false;
  const code = (error as { code?: unknown }).code;
  const cause = (error as { cause?: unknown }).cause;
  return (
    code === "42P01" ||
    (typeof cause === "object" && cause !== null && (cause as { code?: unknown }).code === "42P01")
  );
}

/** Reads what the worker measured from cover pictures, by fingerprint. */
export class DrizzleCoverAnalysisReader implements ICoverAnalysisReader {
  constructor(private readonly db: Database) {}

  async lookupByHashes(hashes: readonly string[]): Promise<Map<string, CoverAnalysisRecord>> {
    const unique = [...new Set(hashes.filter(Boolean))];
    if (unique.length === 0) return new Map();
    try {
      const rows = await this.db
        .select({
          hash: coverAnalysis.hash,
          status: coverAnalysis.status,
          analysis: coverAnalysis.analysis,
        })
        .from(coverAnalysis)
        .where(inArray(coverAnalysis.hash, unique));
      return new Map(
        rows.map((row) => [
          row.hash,
          { hash: row.hash, status: row.status as CoverAnalysisStatus, analysis: row.analysis },
        ]),
      );
    } catch (error) {
      if (isUndefinedTableError(error)) return new Map();
      throw error;
    }
  }
}
