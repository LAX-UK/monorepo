import { describe, expect, it } from "vitest";
import {
  isSofEvidencePdfFileName,
  isSofEvidenceReviewDirty,
  sofEvidenceChecksFromDoc,
} from "./sof-evidence-reviewer.vm";

describe("sof-evidence-reviewer.vm", () => {
  it("maps saved checks from document review", () => {
    expect(
      sofEvidenceChecksFromDoc({
        id: "d1",
        staffReview: {
          checks: {
            matchesDeclaredSource: true,
            coversExposure: false,
            recentEnough: true,
            legibleComplete: false,
          },
          note: "ok",
        },
      } as never),
    ).toEqual({
      matchesDeclaredSource: true,
      coversExposure: false,
      recentEnough: true,
      legibleComplete: false,
    });
  });

  it("detects dirty review state", () => {
    const doc = {
      id: "d1",
      staffReview: {
        checks: {
          matchesDeclaredSource: true,
          coversExposure: true,
          recentEnough: true,
          legibleComplete: true,
        },
        note: "",
      },
    } as never;
    expect(isSofEvidenceReviewDirty(doc, sofEvidenceChecksFromDoc(doc), "note")).toBe(true);
    expect(isSofEvidenceReviewDirty(doc, sofEvidenceChecksFromDoc(doc), "")).toBe(false);
  });

  it("detects pdf filenames", () => {
    expect(isSofEvidencePdfFileName("scan.PDF")).toBe(true);
    expect(isSofEvidencePdfFileName("scan.png")).toBe(false);
  });
});
