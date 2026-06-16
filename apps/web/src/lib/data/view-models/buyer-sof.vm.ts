import type { BuyerSourceOfFundsView } from "@/lib/data/http/compliance.server";

export type BuyerSofUploadCompletion = {
  uploadedCount: number;
  requiredCount: number;
  remainingCount: number;
  allUploaded: boolean;
};

export function computeBuyerSofUploadCompletion(
  view: BuyerSourceOfFundsView,
): BuyerSofUploadCompletion {
  const requiredCount = view.requestedDocumentTypes.length;
  const uploadedCount = view.requestedDocumentTypes.filter((type) =>
    view.documents.some((d) => d.requestedType === type && d.statusLabel !== "superseded"),
  ).length;
  const remainingCount = Math.max(0, requiredCount - uploadedCount);
  return {
    uploadedCount,
    requiredCount,
    remainingCount,
    allUploaded: requiredCount > 0 && remainingCount === 0,
  };
}

export type BuyerSofNextStep = {
  title: string;
  body: string;
};

export function resolveBuyerSofNextStep(view: BuyerSourceOfFundsView): BuyerSofNextStep {
  if (view.decisionOutcome === "approved") {
    return {
      title: "Verification complete",
      body: "You can return to your portfolio to complete checkout.",
    };
  }
  if (view.decisionOutcome === "rejected") {
    return {
      title: "Additional review needed",
      body: "Our compliance team will contact you if further action is required. Checkout remains on hold.",
    };
  }
  if (!view.documentsRequested) {
    return {
      title: "Awaiting instructions",
      body: "Our compliance team will send a secure document request when needed. Reviews typically take 1–2 business days once documents are submitted.",
    };
  }
  if (view.documentsSubmitted) {
    return {
      title: "Submitted for review",
      body: "Thank you — our compliance team is reviewing your documents. We'll email you when there is an update (typically 1–2 business days).",
    };
  }
  const completion = computeBuyerSofUploadCompletion(view);
  if (!completion.allUploaded) {
    return {
      title: "Upload your documents",
      body: `Upload each requested document below (${completion.uploadedCount} of ${completion.requiredCount} uploaded). When everything is ready, submit for review.`,
    };
  }
  return {
    title: "Ready to submit",
    body: "All requested documents are uploaded. Submit for review when you're ready — you won't be able to add more files after submitting.",
  };
}

export function buyerSofSubmitBlockReason(view: BuyerSourceOfFundsView): string | null {
  if (!view.documentsRequested || view.documentsSubmitted || view.decisionOutcome != null) {
    return null;
  }
  const completion = computeBuyerSofUploadCompletion(view);
  if (completion.requiredCount === 0) return "No documents were requested.";
  if (completion.allUploaded) return null;
  if (completion.uploadedCount === 0) {
    return "Upload at least one document before submitting.";
  }
  return `Upload all requested documents before submitting (${completion.remainingCount} remaining).`;
}

export function friendlyBuyerUploadError(raw: string): string {
  const lower = raw.toLowerCase();
  if (lower.includes("malware") || lower.includes("rejected") || lower.includes("invalid")) {
    return "This file couldn't be validated — it may be corrupt or unsupported. Try another file.";
  }
  if (lower.includes("too large") || lower.includes("max")) {
    return raw;
  }
  if (lower.includes("timed out") || lower.includes("validating")) {
    return "We're still checking your file. Wait a moment and try again.";
  }
  return raw;
}
