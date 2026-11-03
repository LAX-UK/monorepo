import type { PictureVerdict } from "./cover-picture-verdict.js";

/** What the backfill found for one picture. */
export type PictureReport = {
  /** The lot photograph the plate uses, or a sale cover picture a slot would use. */
  role: "lot-primary" | "sale-cover";
  source: string;
  width?: number;
  height?: number;
  /** Average brightness, 0 (black) to 1 (white). */
  luminance?: number;
  verdict: PictureVerdict | { ok: false; reason: "unreadable"; error: string };
};

export type BackfillSummary = {
  measured: number;
  usable: number;
  skippedBelowFloor: number;
  unreadable: number;
  skipped: { role: PictureReport["role"]; source: string; reason: string; detail: string }[];
};

/** Counts the pictures by outcome and lists every one that was skipped, with the reason. */
export function summarisePictures(reports: readonly PictureReport[]): BackfillSummary {
  const summary: BackfillSummary = {
    measured: 0,
    usable: 0,
    skippedBelowFloor: 0,
    unreadable: 0,
    skipped: [],
  };
  for (const report of reports) {
    const { verdict } = report;
    if (verdict.ok) {
      summary.measured += 1;
      summary.usable += 1;
      continue;
    }
    if (verdict.reason === "unreadable") {
      summary.unreadable += 1;
      summary.skipped.push({
        role: report.role,
        source: report.source,
        reason: verdict.reason,
        detail: "error" in verdict ? verdict.error : "",
      });
      continue;
    }
    summary.measured += 1;
    summary.skippedBelowFloor += 1;
    summary.skipped.push({
      role: report.role,
      source: report.source,
      reason: verdict.reason,
      detail: "need" in verdict ? `need ${verdict.need}, have ${verdict.have}` : "",
    });
  }
  return summary;
}
