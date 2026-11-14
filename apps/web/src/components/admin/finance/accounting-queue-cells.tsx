"use client";

import {
  type AccountingPartFundedRow,
  type AccountingStaffRow,
  type AccountingUnattributedRow,
  rowMetaParts,
  waitingForLine,
} from "@/lib/admin/finance/accounting-queue.vm";
import { notify } from "@/lib/ui/notify";
import { Notice, RelativeTime, StaffButton, TextLink } from "@auction/staff-ui";
import {
  ACCOUNTING_NO_REASON_TEXT,
  ACCOUNTING_PART_FUNDED_TEXT,
  ACCOUNTING_PART_FUNDED_TITLE,
  ACCOUNTING_UNATTRIBUTED_REFUNDS_ACTION,
  ACCOUNTING_UNATTRIBUTED_REFUNDS_TEXT,
  ACCOUNTING_UNATTRIBUTED_REFUNDS_TITLE,
} from "@auction/types";

/** The Accounting list's row cells, row menu and the part-received panel. */

export type RowActionKind = "try_again" | "release";

/**
 * The row's main action as a button: try a failed one again, release a parked one, or open an
 * issued one in Books.
 */
export function RowAction({
  row,
  canAct,
  onTryAgain,
  onRelease,
}: {
  row: AccountingStaffRow;
  canAct: boolean;
  onTryAgain: (row: AccountingStaffRow) => void;
  onRelease: (row: AccountingStaffRow) => void;
}) {
  if (canAct && row.canRelease) {
    return (
      <StaffButton size="sm" variant="secondary" onClick={() => onRelease(row)}>
        Release
      </StaffButton>
    );
  }
  if (canAct && row.canTryAgain) {
    return (
      <StaffButton size="sm" variant="secondary" onClick={() => onTryAgain(row)}>
        Try again
      </StaffButton>
    );
  }
  if (row.books.kind === "link") {
    return (
      <StaffButton asChild size="sm" variant="secondary">
        <a href={row.books.href} target="_blank" rel="noreferrer">
          Open
        </a>
      </StaffButton>
    );
  }
  return null;
}

type RowMenuDeps = {
  canAct: boolean;
  onTryAgain: (row: AccountingStaffRow) => void;
  onRelease: (row: AccountingStaffRow) => void;
};

export function rowMenuActions(
  row: AccountingStaffRow,
  { canAct, onTryAgain, onRelease }: RowMenuDeps,
) {
  return [
    ...(canAct && row.canRelease
      ? [{ id: "release", label: "Release", onSelect: () => onRelease(row) }]
      : []),
    ...(canAct && row.canTryAgain
      ? [{ id: "try-again", label: "Try again", onSelect: () => onTryAgain(row) }]
      : []),
    ...(row.books.kind === "link"
      ? [{ id: "books", label: "Open in Books", href: row.books.href }]
      : []),
    {
      id: "copy",
      label: "Copy LAX reference",
      onSelect: () => {
        void navigator.clipboard
          ?.writeText(row.reference)
          .then(() => notify.success("LAX reference copied"))
          .catch(() => notify.error("Could not copy the LAX reference"));
      },
    },
  ];
}

/**
 * The phone's "Tried 2 times · last Thu 12 Nov, 09:30 GMT". Where the row's Try again button
 * narrows the column it wraps, first at the dot, rather than cutting the time off.
 */
export function MetaLine({ row }: { row: AccountingStaffRow }) {
  const [tries, last] = rowMetaParts(row);
  return (
    <span data-meta-line className="whitespace-normal break-words">
      <span className="inline-block max-w-full">{tries} ·</span>{" "}
      <span className="inline-block max-w-full">{last}</span>
    </span>
  );
}

export function ProblemCell({ row, issued }: { row: AccountingStaffRow; issued: boolean }) {
  if (issued) {
    if (row.books.kind === "link") {
      return (
        <TextLink href={row.books.href} external>
          {row.books.label}
        </TextLink>
      );
    }
    if (row.books.kind === "text")
      return <span className="text-staff-muted">{row.books.label}</span>;
    return <span className="text-staff-muted">Not in Books</span>;
  }
  // A queued document held by another names it and where it is: "Waiting for … · Failed".
  const waiting = row.problem ? null : waitingForLine(row);
  if (waiting) {
    return <span className="line-clamp-2 whitespace-normal text-staff-muted">{waiting}</span>;
  }
  // A failed document with no stored reason still reads as an answer from Books, not a blank.
  if (!row.problem) {
    const text = row.state.tone === "danger" ? ACCOUNTING_NO_REASON_TEXT : "None";
    return <span className="text-staff-muted">{text}</span>;
  }
  // Up to two lines, then an ellipsis; the whole reason is in the details sheet.
  return <span className="line-clamp-2 whitespace-normal">{row.problem}</span>;
}

/**
 * Bank transfers that have partly arrived. Nothing is sent to Books for them: the payment goes once
 * the whole amount has arrived and been applied. Listed so finance can reconcile what is in the
 * bank against what is in the books.
 */
export function PartFundedNotice({ transfers }: { transfers: AccountingPartFundedRow[] }) {
  return (
    <Notice tone="info" title={`${ACCOUNTING_PART_FUNDED_TITLE} (${transfers.length})`}>
      <p>{ACCOUNTING_PART_FUNDED_TEXT}</p>
      <ul className="mt-2 flex flex-col gap-1.5" aria-label={ACCOUNTING_PART_FUNDED_TITLE}>
        {transfers.map((t) => (
          <li key={t.reference} className="flex flex-wrap gap-x-2 break-words">
            <span className="font-medium text-staff-fg [overflow-wrap:anywhere]">
              {t.reference}
            </span>
            <span className="text-staff-muted">
              {t.kind} · {t.buyer} · {t.received}
              {t.since ? (
                <>
                  {" "}
                  · last <RelativeTime value={t.since} />
                </>
              ) : null}
            </span>
          </li>
        ))}
      </ul>
    </Notice>
  );
}

/**
 * "Pay several" refunds that named no invoice or courier quote (or the part above what one was
 * charged). Nothing goes to Books for them until a person assigns each to what it was for; then
 * its credit note follows like any other refund's. Listed under the "Assign refund" wording.
 */
export function UnattributedRefundsNotice({ refunds }: { refunds: AccountingUnattributedRow[] }) {
  return (
    <Notice tone="warning" title={`${ACCOUNTING_UNATTRIBUTED_REFUNDS_TITLE} (${refunds.length})`}>
      <p>{ACCOUNTING_UNATTRIBUTED_REFUNDS_TEXT}</p>
      <ul className="mt-2 flex flex-col gap-1.5" aria-label={ACCOUNTING_UNATTRIBUTED_REFUNDS_TITLE}>
        {refunds.map((r) => (
          <li key={r.paymentGroupId} className="flex flex-wrap gap-x-2 break-words">
            <span className="font-medium text-staff-fg">
              {ACCOUNTING_UNATTRIBUTED_REFUNDS_ACTION}
            </span>
            <span className="text-staff-muted [overflow-wrap:anywhere]">
              Pay several · {r.buyer} · {r.amount}
            </span>
          </li>
        ))}
      </ul>
    </Notice>
  );
}
