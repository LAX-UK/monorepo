import type { AdminSourceOfFundsDetail } from "@/lib/data/http/compliance.server";

export type SofEvidenceDoc = AdminSourceOfFundsDetail["submittedDocuments"][number];

export type SofEvidenceCheckState = {
  matchesDeclaredSource: boolean;
  coversExposure: boolean;
  recentEnough: boolean;
  legibleComplete: boolean;
};

export function sofEvidenceChecksFromDoc(doc: SofEvidenceDoc | null): SofEvidenceCheckState {
  return {
    matchesDeclaredSource: Boolean(doc?.staffReview?.checks.matchesDeclaredSource),
    coversExposure: Boolean(doc?.staffReview?.checks.coversExposure),
    recentEnough: Boolean(doc?.staffReview?.checks.recentEnough),
    legibleComplete: Boolean(doc?.staffReview?.checks.legibleComplete),
  };
}

export function isSofEvidenceReviewDirty(
  doc: SofEvidenceDoc | null,
  checks: SofEvidenceCheckState,
  note: string,
): boolean {
  if (!doc) return false;
  const saved = sofEvidenceChecksFromDoc(doc);
  const savedNote = doc.staffReview?.note ?? "";
  return (
    checks.matchesDeclaredSource !== saved.matchesDeclaredSource ||
    checks.coversExposure !== saved.coversExposure ||
    checks.recentEnough !== saved.recentEnough ||
    checks.legibleComplete !== saved.legibleComplete ||
    note !== savedNote
  );
}

export function isSofEvidencePdfFileName(name: string): boolean {
  return name.toLowerCase().endsWith(".pdf");
}
