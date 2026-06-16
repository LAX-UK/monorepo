"use client";

import type { AdminSourceOfFundsDetail } from "@/lib/data/http/compliance.server";
import type { AdminSofTableRow } from "@/lib/data/view-models/admin-sof-table.vm";
import {
  resolveSofNextAction,
  summarizeEvidenceSufficiency,
} from "@/lib/data/view-models/admin-sof-timeline.vm";
import { Alert, AlertDescription, AlertTitle } from "@auction/ui/components/alert";

type Props = {
  row: AdminSofTableRow;
  detail: AdminSourceOfFundsDetail | null;
  canTriage: boolean;
  canDecide: boolean;
  currentUserId: string;
};

export function SofNextActionCallout({ row, detail, canTriage, canDecide, currentUserId }: Props) {
  const docs = detail?.submittedDocuments ?? [];
  const sufficiency = summarizeEvidenceSufficiency(docs);
  const action = resolveSofNextAction(
    { row, detail },
    { canTriage, canDecide, currentUserId },
    sufficiency.summary,
  );

  return (
    <Alert variant={action.variant === "destructive" ? "destructive" : "default"}>
      <AlertTitle>{action.title}</AlertTitle>
      <AlertDescription>{action.body}</AlertDescription>
    </Alert>
  );
}
