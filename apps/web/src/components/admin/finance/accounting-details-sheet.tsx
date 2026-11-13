"use client";

import type { AccountingStaffRow } from "@/lib/admin/finance/accounting-queue.vm";
import {
  DetailPanel,
  KeyValueList,
  Notice,
  StaffButton,
  StaffDate,
  StatusBadge,
} from "@auction/staff-ui";
import { ACCOUNTING_NO_REASON_TEXT } from "@auction/types";

/** Everything about one document, opened from a row: the full problem, dates and the action. */
export function AccountingDetailsSheet({
  row,
  canAct,
  onClose,
  onTryAgain,
}: {
  row: AccountingStaffRow | null;
  canAct: boolean;
  onClose: () => void;
  onTryAgain: (row: AccountingStaffRow) => void;
}) {
  const problem =
    row && row.books.kind !== "none" && row.state.label === "In Books"
      ? null
      : (row?.problem ?? (row ? ACCOUNTING_NO_REASON_TEXT : null));
  return (
    <DetailPanel
      open={row !== null}
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
      title={row?.reference ?? ""}
      description={row?.kind}
      status={row ? <StatusBadge tone={row.state.tone}>{row.state.label}</StatusBadge> : null}
      {...(row && canAct && row.canTryAgain
        ? {
            footer: (
              <StaffButton variant="primary" onClick={() => onTryAgain(row)}>
                Try again
              </StaffButton>
            ),
          }
        : row?.books.kind === "link"
          ? {
              footer: (
                <StaffButton asChild variant="primary">
                  <a href={row.books.href} target="_blank" rel="noreferrer">
                    Open in Books
                  </a>
                </StaffButton>
              ),
            }
          : {})}
    >
      {row ? (
        <div className="flex flex-col gap-4">
          {problem ? (
            <Notice tone={row.state.tone === "danger" ? "danger" : "info"} title="Last problem">
              {problem}
            </Notice>
          ) : null}
          <KeyValueList
            items={[
              { label: "Company", value: row.company },
              { label: "Amount", value: row.amount, numeric: true },
              { label: "Attempts", value: row.attempts, numeric: true },
              {
                label: "LAX reference",
                value: row.reference,
                copyValue: row.reference,
              },
              ...(row.books.kind === "link" || row.books.kind === "text"
                ? [{ label: "Books number", value: row.books.label }]
                : []),
              { label: "Created", value: <StaffDate value={row.createdAt} withTime /> },
              { label: "Updated", value: <StaffDate value={row.updatedAt} withTime /> },
            ]}
          />
        </div>
      ) : null}
    </DetailPanel>
  );
}
