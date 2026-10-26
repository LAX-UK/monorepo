"use client";

import type { AdminSourceOfFundsDetail } from "@/lib/data/http/compliance.server";
import type { AdminSofTableRow } from "@/lib/data/view-models/admin-sof-table.vm";
import {
  resolveSofNextAction,
  summarizeEvidenceSufficiency,
} from "@/lib/data/view-models/admin-sof-timeline.vm";
import { Notice } from "@auction/staff-ui";

type Props = {
  row: AdminSofTableRow;
  detail: AdminSourceOfFundsDetail | null;
  canTriage: boolean;
  canDecide: boolean;
  currentUserId: string;
};

/** What happens next on this case, and whose turn it is. */
export function SofNextActionCallout({ row, detail, canTriage, canDecide, currentUserId }: Props) {
  const docs = detail?.submittedDocuments ?? [];
  const sufficiency = summarizeEvidenceSufficiency(docs);
  const action = resolveSofNextAction(
    { row, detail },
    { canTriage, canDecide, currentUserId },
    sufficiency.summary,
  );

  return (
    <Notice tone={action.variant === "destructive" ? "danger" : "info"} title={action.title}>
      {action.body}
    </Notice>
  );
}
