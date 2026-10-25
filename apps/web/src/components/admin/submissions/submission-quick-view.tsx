"use client";

import type { SubmissionsStaffRow } from "@/lib/admin/submissions/submissions-staff-list.vm";
import {
  DetailPanel,
  Notice,
  type OverflowAction,
  OverflowMenu,
  PanelSection,
  RecordImage,
  StaffButton,
  StaffDate,
  StatusBadge,
} from "@auction/staff-ui";
import { ArrowUpRight } from "lucide-react";
import Link from "next/link";

/**
 * A submission beside the list: its photo, seller, waiting time, what is missing, and the same
 * review actions as the row's `…` menu. Built from the row the list already loaded, so it opens
 * at once; the full review is one link away.
 */
export function SubmissionQuickView({
  row,
  onClose,
  actions,
}: {
  row: SubmissionsStaffRow | null;
  onClose: () => void;
  actions: readonly OverflowAction[];
}) {
  const required = row?.gaps.filter((gap) => gap.required) ?? [];
  const advisory = row?.gaps.filter((gap) => !gap.required) ?? [];
  return (
    <DetailPanel
      open={row !== null}
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
      title={row?.title ?? "Submission"}
      status={
        row ? (
          <StatusBadge tone={row.status.tone} live={row.status.live ?? false}>
            {row.status.label}
          </StatusBadge>
        ) : null
      }
      meta={
        row
          ? [
              { label: "Seller", value: row.seller },
              ...(row.category ? [{ label: "Category", value: row.category }] : []),
            ]
          : []
      }
      headerActions={
        row ? (
          <StaffButton asChild variant="ghost" size="sm" icon={<ArrowUpRight aria-hidden />}>
            <Link href={row.href}>Open review</Link>
          </StaffButton>
        ) : null
      }
      overflow={
        actions.length > 0 ? (
          <OverflowMenu label="Submission actions" actions={actions} Link={Link} />
        ) : null
      }
      notice={
        required.length > 0 ? (
          <Notice tone="danger" title="It cannot be accepted yet">
            {required.map((gap) => gap.description).join(" ")}
          </Notice>
        ) : null
      }
      summary={
        row
          ? [
              {
                label: "Waiting",
                value: row.waiting ? (
                  <StatusBadge tone={row.waiting.tone}>{row.waiting.label}</StatusBadge>
                ) : null,
              },
              { label: "Assigned to", value: row.assignee ?? "No one yet" },
              { label: "Submitted", value: <StaffDate value={row.submittedAt} withTime /> },
              { label: "Submission ID", value: row.id, copyValue: row.id },
            ]
          : []
      }
    >
      {advisory.length > 0 ? (
        <Notice tone="warning" title="Worth checking">
          {advisory.map((gap) => gap.description).join(" ")}
        </Notice>
      ) : null}
      {row?.thumbnailUrl ? (
        <PanelSection title="Photo">
          <RecordImage src={row.thumbnailUrl} alt={row.title} />
        </PanelSection>
      ) : null}
    </DetailPanel>
  );
}
