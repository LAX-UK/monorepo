import type { AdminSourceOfFundsDetail } from "@/lib/data/http/compliance.server";
import type { AdminSofTableRow } from "@/lib/data/view-models/admin-sof-table.vm";
import { formatDateTime } from "@/lib/ui/format";

export type SofTimelineStepState = "complete" | "current" | "upcoming";

export type SofTimelineStep = {
  id: string;
  label: string;
  state: SofTimelineStepState;
  detail?: string | null;
  turnLabel?: string | null;
};

export type BuildSofTimelineInput = {
  row: AdminSofTableRow;
  detail: AdminSourceOfFundsDetail | null;
  canTriage: boolean;
  canDecide: boolean;
  currentUserId: string;
};

export type SofWorkflowSnapshot = {
  row: AdminSofTableRow;
  detail: AdminSourceOfFundsDetail | null;
};

export type SofWorkflowFlags = {
  requested: boolean;
  submitted: boolean;
  hasDocs: boolean;
  triaged: boolean;
  decided: boolean;
  fourEyesSelfBlock: boolean;
};

export function resolveSofWorkflowFlags(
  snapshot: SofWorkflowSnapshot,
  viewer: { canDecide: boolean; currentUserId: string },
): SofWorkflowFlags {
  const { row, detail } = snapshot;
  const docRequest = detail?.documentRequest;
  const hasDocs = (detail?.submittedDocuments.length ?? row.evidenceCount) > 0;
  const requested = Boolean(docRequest?.requestedAt);
  const submitted = Boolean(docRequest?.submittedAt);
  const triaged = Boolean(row.triageRecommendation);
  const decided = Boolean(row.reviewedAt);
  const fourEyesSelfBlock =
    triaged && viewer.canDecide && row.triagedByUserId === viewer.currentUserId;

  return { requested, submitted, hasDocs, triaged, decided, fourEyesSelfBlock };
}

export type SofNextAction = {
  title: string;
  body: string;
  variant: "default" | "destructive";
};

export function resolveSofNextAction(
  snapshot: SofWorkflowSnapshot,
  viewer: { canTriage: boolean; canDecide: boolean; currentUserId: string },
  sufficiencySummary: string,
): SofNextAction {
  const { row } = snapshot;
  const flags = resolveSofWorkflowFlags(snapshot, viewer);
  const { requested, submitted, hasDocs, triaged, fourEyesSelfBlock } = flags;

  if (row.status === "approved") {
    return {
      title: "Case closed — approved",
      body: "This case cleared the settlement gate for the buyer (subject to validity rules).",
      variant: "default",
    };
  }
  if (row.status === "rejected") {
    return {
      title: "Case closed — rejected",
      body: "Rejected cases stay blocking until manually reopened by MLRO.",
      variant: "destructive",
    };
  }
  if (!viewer.canTriage && !viewer.canDecide) {
    return {
      title: "Compliance hold active",
      body: "Settlement is blocked until MLRO approves this case. Finance cannot release payments from the manual review queue.",
      variant: "default",
    };
  }
  if (!requested && viewer.canTriage) {
    return {
      title: "Next: request documents",
      body: "Select evidence types and send a document request to the buyer before triage.",
      variant: "default",
    };
  }
  if (requested && !submitted && viewer.canTriage) {
    return {
      title: "Awaiting buyer",
      body: "The buyer has been notified. Review evidence when uploads appear, then record triage.",
      variant: "default",
    };
  }
  if ((submitted || hasDocs) && !triaged && viewer.canTriage) {
    return {
      title: "Next: review evidence and triage",
      body: `${sufficiencySummary} Record your analyst recommendation when ready.`,
      variant: "default",
    };
  }
  if (triaged && fourEyesSelfBlock) {
    return {
      title: "Awaiting different MLRO (four-eyes)",
      body: `You recorded triage on this case. A different MLRO must make the binding decision. ${sufficiencySummary}`,
      variant: "default",
    };
  }
  if (triaged && viewer.canDecide) {
    return {
      title: "Next: MLRO decision",
      body: `Analyst recommends ${row.triageRecommendation === "recommend_approve" ? "approve" : "reject"}. ${sufficiencySummary}`,
      variant: "default",
    };
  }
  if (triaged) {
    return {
      title: "Awaiting MLRO",
      body: "Triage is complete. An MLRO with decide access must approve or reject.",
      variant: "default",
    };
  }
  if (viewer.canTriage) {
    return {
      title: "Analyst action required",
      body: sufficiencySummary,
      variant: "default",
    };
  }
  return {
    title: "Read-only view",
    body: "Settlement is blocked until MLRO approves this case. Finance cannot release payments from the manual review queue.",
    variant: "default",
  };
}

export function buildSofTimeline(input: BuildSofTimelineInput): SofTimelineStep[] {
  const { row, detail, canTriage, canDecide, currentUserId } = input;
  const flags = resolveSofWorkflowFlags({ row, detail }, { canDecide, currentUserId });
  const { requested, submitted, hasDocs, triaged, decided, fourEyesSelfBlock } = flags;
  const docRequest = detail?.documentRequest;

  if (row.status === "approved" || row.status === "rejected") {
    return [
      {
        id: "outcome",
        label: row.status === "approved" ? "Approved" : "Rejected",
        state: "complete",
        detail: row.reviewedAt ? formatDateTime(row.reviewedAt) : null,
      },
    ];
  }

  const steps: SofTimelineStep[] = [
    {
      id: "opened",
      label: "Case opened",
      state: "complete",
      detail: row.openedLabel,
    },
    {
      id: "requested",
      label: "Documents requested",
      state: requested ? (submitted || hasDocs ? "complete" : "current") : "upcoming",
      detail: requested && docRequest?.requestedAt ? formatDateTime(docRequest.requestedAt) : null,
      turnLabel:
        !requested && canTriage && row.status === "pending"
          ? "Your turn — request documents"
          : !requested
            ? "Awaiting analyst"
            : null,
    },
    {
      id: "upload",
      label: "Buyer uploads",
      state: hasDocs ? (submitted ? "complete" : "current") : "upcoming",
      detail: submitted && docRequest?.submittedAt ? formatDateTime(docRequest.submittedAt) : null,
      turnLabel: requested && !submitted && !hasDocs ? "Awaiting buyer upload" : null,
    },
    {
      id: "triage",
      label: "Analyst triage",
      state: triaged ? "complete" : submitted || hasDocs ? "current" : "upcoming",
      detail: triaged
        ? `${row.triageLabel}${row.triagedAt ? ` · ${formatDateTime(row.triagedAt)}` : ""}`
        : null,
      turnLabel:
        !triaged && canTriage && (submitted || hasDocs)
          ? "Your turn — record triage"
          : !triaged && (submitted || hasDocs)
            ? "Awaiting analyst triage"
            : null,
    },
    {
      id: "decision",
      label: "MLRO decision",
      state: decided ? "complete" : triaged ? "current" : "upcoming",
      detail: decided && row.reviewedAt ? formatDateTime(row.reviewedAt) : null,
      turnLabel: triaged
        ? fourEyesSelfBlock
          ? "Awaiting different MLRO (four-eyes)"
          : canDecide
            ? "Your turn — approve or reject"
            : "Awaiting MLRO decision"
        : null,
    },
  ];

  return steps;
}

export type SofEvidenceSufficiency = {
  reviewedCount: number;
  totalCount: number;
  allComplete: boolean;
  summary: string;
};

export function summarizeEvidenceSufficiency(
  documents: AdminSourceOfFundsDetail["submittedDocuments"],
): SofEvidenceSufficiency {
  const totalCount = documents.length;
  const reviewed = documents.filter((d) => d.staffReview != null);
  const reviewedCount = reviewed.length;
  const allComplete =
    reviewedCount > 0 &&
    reviewed.every((d) => {
      const c = d.staffReview?.checks;
      if (!c) return false;
      return c.matchesDeclaredSource && c.coversExposure && c.recentEnough && c.legibleComplete;
    });

  let summary = "No documents submitted yet.";
  if (totalCount > 0 && reviewedCount === 0) {
    summary = `${totalCount} document${totalCount === 1 ? "" : "s"} awaiting staff review.`;
  } else if (reviewedCount > 0 && reviewedCount < totalCount) {
    summary = `${reviewedCount} of ${totalCount} documents reviewed.`;
  } else if (allComplete) {
    summary = "All submitted documents pass the verification checklist.";
  } else if (reviewedCount === totalCount) {
    summary = "All documents reviewed; some checklist items need attention.";
  }

  return { reviewedCount, totalCount, allComplete, summary };
}
