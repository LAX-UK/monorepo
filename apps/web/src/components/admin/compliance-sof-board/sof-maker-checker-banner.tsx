"use client";

import type { AdminSofTableRow } from "@/lib/data/view-models/admin-sof-table.vm";
import { Alert, AlertDescription, AlertTitle } from "@auction/ui/components/alert";

type Props = {
  row: AdminSofTableRow;
  canTriage: boolean;
  canDecide: boolean;
  currentUserId: string;
};

export function SofMakerCheckerBanner({ row, canTriage, canDecide, currentUserId }: Props) {
  if (row.status === "approved" || row.status === "rejected") {
    return (
      <Alert>
        <AlertTitle>Case {row.status}</AlertTitle>
        <AlertDescription>
          This case has a final MLRO decision. Rejected cases stay blocking until manually reopened.
        </AlertDescription>
      </Alert>
    );
  }

  if (!row.triageRecommendation) {
    return (
      <Alert>
        <AlertTitle>Awaiting analyst triage</AlertTitle>
        <AlertDescription>
          {canTriage
            ? "Record a first-line recommendation (Step 1). You cannot decide your own triage."
            : "A compliance analyst with triage access must record a recommendation before MLRO can decide."}
        </AlertDescription>
      </Alert>
    );
  }

  const sameAsTriager = row.triagedByUserId === currentUserId;
  return (
    <Alert>
      <AlertTitle>Awaiting MLRO decision</AlertTitle>
      <AlertDescription>
        Triage recorded ({row.triageLabel}).
        {canDecide
          ? sameAsTriager
            ? " You recorded the triage — a different MLRO must make the binding decision (four-eyes)."
            : " You may approve or reject this case (Step 2)."
          : " An MLRO or finance user with decide access must approve or reject."}
      </AlertDescription>
    </Alert>
  );
}
