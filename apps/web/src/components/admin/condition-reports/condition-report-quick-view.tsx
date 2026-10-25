"use client";

import { ConditionReportFulfilForm } from "@/components/admin/condition-reports/condition-report-fulfil-form";
import type { ConditionReportStaffRow } from "@/lib/admin/condition-reports/condition-reports-staff-list.vm";
import {
  CellLink,
  DetailPanel,
  type OverflowAction,
  OverflowMenu,
  PanelSection,
  StaffButton,
  StaffDate,
  StatusBadge,
} from "@auction/staff-ui";
import { ArrowUpRight } from "lucide-react";
import Link from "next/link";
import { useState } from "react";

/**
 * A condition report request beside the list: who asked and what they asked, and for an open
 * request the form that fulfils it. Closing the panel with the form half filled asks first.
 * Decline and "in progress" are in the footer and the `…` menu, the same as on the row.
 */
export function ConditionReportQuickView({
  row,
  onClose,
  onFulfilled,
  actions,
}: {
  row: ConditionReportStaffRow | null;
  onClose: () => void;
  /** Runs after the report is published; the list refreshes and the panel closes. */
  onFulfilled: () => void;
  actions: readonly OverflowAction[];
}) {
  const [dirty, setDirty] = useState(false);
  // Fulfilling happens in the form below, so the panel does not offer it again in a menu.
  const others = actions.filter((action) => action.id !== "fulfil");

  return (
    <DetailPanel
      open={row !== null}
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
      dirty={dirty}
      dirtyLabel="this request"
      size="lg"
      title={row?.lotTitle ?? "Condition report request"}
      status={row ? <StatusBadge tone={row.status.tone}>{row.status.label}</StatusBadge> : null}
      meta={
        row
          ? [
              ...(row.requester
                ? [
                    {
                      label: "Requester",
                      value: (
                        <CellLink href={row.requesterHref} Link={Link}>
                          {row.requester}
                        </CellLink>
                      ),
                    },
                  ]
                : []),
              { label: "Requested", value: <StaffDate value={row.requestedAt} withTime /> },
            ]
          : []
      }
      headerActions={
        row ? (
          <StaffButton asChild variant="ghost" size="sm" icon={<ArrowUpRight aria-hidden />}>
            <Link href={row.lotHref}>Open lot</Link>
          </StaffButton>
        ) : null
      }
      overflow={
        others.length > 0 ? (
          <OverflowMenu label="Request actions" actions={others} Link={Link} />
        ) : null
      }
      summary={
        row
          ? [
              { label: "Question", value: row.requestNote },
              ...(row.fulfilledAt
                ? [{ label: "Fulfilled", value: <StaffDate value={row.fulfilledAt} withTime /> }]
                : []),
              ...(row.closed
                ? [
                    {
                      label: row.statusCode === "declined" ? "Reason" : "Internal note",
                      value: row.responseNote,
                    },
                  ]
                : []),
              { label: "Request ID", value: row.id, copyValue: row.id },
            ]
          : []
      }
      footer={
        row && !row.closed && others.length > 0
          ? others.map((action) => (
              <StaffButton
                key={action.id}
                variant={action.tone === "danger" ? "danger" : "secondary"}
                onClick={action.onSelect}
              >
                {action.label}
              </StaffButton>
            ))
          : null
      }
    >
      {row && !row.closed ? (
        <PanelSection title="Fulfil request">
          <ConditionReportFulfilForm
            key={row.id}
            requestId={row.id}
            onFulfilled={onFulfilled}
            onDirtyChange={setDirty}
          />
        </PanelSection>
      ) : null}
    </DetailPanel>
  );
}
