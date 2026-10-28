import { CLIENT_ROUTES } from "@/lib/navigation/client-routes";
import type {
  ConsignmentChecklistDeadline,
  ConsignmentChecklistItemId,
  ConsignmentChecklistRollupItem,
} from "@auction/domain";
import {
  type ChecklistCopyContext,
  type ChecklistItemView,
  checklistItemView,
} from "./consignment-checklist-copy";

export type ChecklistRollupRowView = ChecklistItemView & {
  /** Which consignments the item is for, as people read it. */
  concerns: string;
};

const DEADLINES: Record<ConsignmentChecklistItemId, ConsignmentChecklistDeadline> = {
  identity: { kind: "before_specialist_accepts" },
  agreement: { kind: "before_cataloguing" },
  payouts: { kind: "before_sale_live", date: null },
};

function concerns(titles: readonly string[]): string {
  const quoted = titles.map((title) => `"${title}"`);
  if (quoted.length <= 2) return `For ${quoted.join(" and ")}`;
  return `For ${quoted[0]} and ${quoted.length - 1} more`;
}

/**
 * The Selling overview's "Before your works can go to sale": one row per open item across
 * consignments, saying which works it concerns. An agreement opens the consignment it is for;
 * with several, the consignments list.
 */
export function checklistRollupRows(
  rollup: readonly ConsignmentChecklistRollupItem[],
  ctx: Omit<ChecklistCopyContext, "agreementHref">,
): ChecklistRollupRowView[] {
  return rollup.map((row) => {
    const [first] = row.consignments;
    const agreementHref =
      row.consignments.length === 1 && first
        ? `${CLIENT_ROUTES.consignments}/${first.id}#agreement`
        : CLIENT_ROUTES.consignments;
    const view = checklistItemView(
      { id: row.id, state: row.state, deadline: DEADLINES[row.id], waitingOn: row.waitingOn },
      { ...ctx, agreementHref },
    );
    return { ...view, concerns: concerns(row.consignments.map((c) => c.title)) };
  });
}
