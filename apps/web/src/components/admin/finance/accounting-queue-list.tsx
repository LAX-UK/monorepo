"use client";

import { useStaffListNavigation } from "@/components/admin/staff/use-staff-list-navigation";
import { tryAgainAccountingDocumentAction } from "@/lib/actions/admin/admin-accounting";
import {
  ACCOUNTING_DESCRIPTION,
  ACCOUNTING_EMPTY_COPY,
  ACCOUNTING_REHEARSAL_NOTICE,
  type AccountingSearch,
  type AccountingStaffRow,
  ORGANISATION_SEGMENTS,
  accountingHref,
  accountingTabs,
  legalNamesForFilter,
  lockedPeriodTitle,
  rowMetaParts,
  tryAgainCopy,
  tryAgainToast,
} from "@/lib/admin/finance/accounting-queue.vm";
import { notify } from "@/lib/ui/notify";
import {
  ConfirmActionDialog,
  type DataColumn,
  DataViews,
  DetailPanel,
  KeyValueList,
  ListPage,
  Notice,
  PrimaryCell,
  RelativeTime,
  SegmentedControl,
  StaffButton,
  StaffCheckbox,
  StaffDate,
  StatusBadge,
  TableSearch,
  TextLink,
} from "@auction/staff-ui";
import {
  ACCOUNTING_LOCKED_PERIOD_ACKNOWLEDGEMENT,
  ACCOUNTING_LOCKED_PERIOD_TEXT,
  ACCOUNTING_NO_REASON_TEXT,
  type AccountingLastSent,
  type AccountingOrganisation,
  type AccountingQueueTab,
} from "@auction/types";
import { useRouter } from "next/navigation";
import { useCallback, useId, useMemo, useState, useTransition } from "react";

export type AccountingQueueListProps = {
  search: AccountingSearch;
  tab: AccountingQueueTab;
  rows: AccountingStaffRow[];
  counts: Record<AccountingQueueTab, number>;
  /** How many documents reached Books today (London); the Issued tab's count. */
  issuedToday: number;
  /** The latest document issued (or rehearsed) for the company filter; null when none. */
  lastSent: AccountingLastSent | null;
  /** The company filter in force, or null for both. */
  organisation: AccountingOrganisation | null;
  /** The toolbar reference search, as typed. */
  reference: string;
  /** The search holds something that is not a LAX reference. */
  referenceError: string | null;
  pageSize: number;
  pagination: { summary: string; prevHref: string | null; nextHref: string | null } | null;
  filtered: boolean;
  loadError: string | null;
  /** The person holds the finance write permission; without it the page is view only. */
  canAct: boolean;
  /** Some rows were prepared in rehearsal, so nothing reached Books. */
  rehearsal: boolean;
  /** Stored documents that could not be read back; counted, not listed. */
  unreadable: number;
};

/**
 * Finance › Accounting on the staff list template: what LAX sends to Zoho Books for both
 * companies, one tab per stage (needs a person, failed, waiting, in Books). "Try again" sends the
 * same document under the same LAX reference, after a confirm; it is offered only to people with
 * the finance write permission and only where the document's state allows it. The header names the
 * source and when it last reached Books; a row opens a details sheet, and each row's main action
 * is a visible button as well as an entry in its … menu.
 */
export function AccountingQueueList(props: AccountingQueueListProps) {
  const { search, rows, tab, canAct, organisation } = props;
  const router = useRouter();
  const { pending, navigate, Link: ListLink } = useStaffListNavigation();
  const [confirming, setConfirming] = useState<{ row: AccountingStaffRow; key: string } | null>(
    null,
  );
  const [acknowledged, setAcknowledged] = useState(false);
  const [details, setDetails] = useState<AccountingStaffRow | null>(null);
  const [failure, setFailure] = useState<string | null>(null);
  const [busy, startTransition] = useTransition();
  const acknowledgeId = useId();

  const askTryAgain = useCallback((row: AccountingStaffRow) => {
    setFailure(null);
    setAcknowledged(false);
    setConfirming({ row, key: crypto.randomUUID() });
  }, []);

  const columns = useMemo<DataColumn<AccountingStaffRow>[]>(
    () => [
      {
        id: "document",
        header: "Document",
        width: "172px",
        mobile: "title",
        truncate: false, // the LAX reference is read whole: it wraps, never cut
        cell: (row) => (
          <PrimaryCell secondary={row.kind} wrap>
            {row.reference}
          </PrimaryCell>
        ),
      },
      {
        id: "state",
        header: "Status",
        width: "136px",
        mobile: "meta",
        truncate: false,
        cell: (row) => <StatusBadge tone={row.state.tone}>{row.state.label}</StatusBadge>,
      },
      {
        id: "problem",
        header: tab === "issued" ? "In Books" : "Last problem",
        minWidth: "220px", // matters most after Document, so it takes the spare room
        truncate: false,
        mobile: "detail",
        cell: (row) => <ProblemCell row={row} issued={tab === "issued"} />,
      },
      {
        id: "company",
        header: "Company",
        width: "140px",
        hideBelow: "lg",
        mobile: "hidden",
        truncate: false, // the legal name wraps to a second line rather than being cut
        cell: (row) => <span className="line-clamp-2 whitespace-normal">{row.company}</span>,
      },
      {
        id: "amount",
        header: "Amount",
        width: "96px",
        numeric: true,
        sortable: true,
        sortValue: (row) => row.grossPence,
        defaultSortDirection: "desc",
        mobile: "meta",
        cell: (row) => row.amount,
      },
      {
        id: "attempts",
        header: "Attempts",
        width: "92px",
        numeric: true,
        sortable: true,
        sortValue: (row) => row.attempts,
        defaultSortDirection: "desc",
        hideBelow: "lg",
        mobile: "hidden",
        cell: (row) => row.attempts,
      },
      {
        id: "updated",
        header: "Updated",
        width: "112px",
        sortable: true,
        sortValue: (row) => Date.parse(row.updatedAt),
        defaultSortDirection: "desc",
        hideBelow: "md",
        mobile: "hidden",
        truncate: false,
        cell: (row) => <StaffDate value={row.updatedAt} withTime className="whitespace-normal" />,
      },
      {
        id: "created",
        header: "Created",
        width: "112px",
        sortable: true,
        sortValue: (row) => Date.parse(row.createdAt),
        defaultSortDirection: "desc",
        hideBelow: "xl",
        mobile: "hidden",
        truncate: false,
        cell: (row) => <StaffDate value={row.createdAt} withTime className="whitespace-normal" />,
      },
      {
        id: "tried",
        header: "Tried",
        headerHidden: true,
        phoneOnly: true,
        mobile: "meta",
        cell: (row) => <MetaLine row={row} />,
      },
      {
        id: "action",
        header: "Action",
        headerHidden: true,
        width: "104px",
        truncate: false,
        mobile: "actions",
        cell: (row) => <RowAction row={row} canAct={canAct} onTryAgain={askTryAgain} />,
      },
    ],
    [tab, canAct, askTryAgain],
  );

  const copy = ACCOUNTING_EMPTY_COPY[tab];

  const submit = () => {
    if (!confirming) return;
    const { row, key } = confirming;
    setFailure(null);
    startTransition(async () => {
      const result = await tryAgainAccountingDocumentAction({
        documentId: row.id,
        idempotencyKey: key,
      });
      if (result.ok) {
        setConfirming(null);
        notify.success(tryAgainToast(result.data?.outcome ?? "requeued", row.reference));
        router.refresh();
        return;
      }
      setFailure(result.error);
    });
  };

  const dialogRow = confirming?.row ?? null;
  const dialogCopy = dialogRow ? tryAgainCopy(dialogRow) : null;
  const lockedConfirm = Boolean(dialogRow?.lockedPeriod);
  const locked = rows.filter((row) => row.lockedPeriod).length;
  const hasNotice =
    locked > 0 || props.rehearsal || props.unreadable > 0 || props.referenceError !== null;
  const notices = (
    <>
      {props.referenceError ? (
        <Notice tone="warning" title="That is not a LAX reference">
          {props.referenceError}
        </Notice>
      ) : null}
      {locked > 0 ? (
        <Notice tone="warning" title={lockedPeriodTitle(locked)}>
          {ACCOUNTING_LOCKED_PERIOD_TEXT}
        </Notice>
      ) : null}
      {props.rehearsal ? (
        <Notice tone="info" title="Rehearsal only">
          {ACCOUNTING_REHEARSAL_NOTICE}
        </Notice>
      ) : null}
      {props.unreadable > 0 ? (
        <Notice tone="warning" title="Some documents could not be read">
          {props.unreadable === 1
            ? "One stored document could not be read and is not listed. Ask engineering to look at it."
            : `${props.unreadable} stored documents could not be read and are not listed. Ask engineering to look at them.`}
        </Notice>
      ) : null}
    </>
  );

  return (
    <>
      <ListPage<AccountingStaffRow>
        title="Accounting"
        description={<SourceLine lastSent={props.lastSent} organisation={organisation} />}
        Link={ListLink}
        listKey="bid-admin.accounting"
        access={canAct ? "full" : "read-only"}
        notice={hasNotice ? notices : undefined}
        views={
          <DataViews
            views={accountingTabs(search, props.counts, props.issuedToday)}
            activeId={tab}
            Link={ListLink}
          />
        }
        search={
          <TableSearch
            value={props.reference}
            label="Search by LAX reference"
            placeholder="Search by LAX reference"
            fullWidth
            onSearch={(q) => navigate(accountingHref(search, { reference: q || null }))}
          />
        }
        filters={
          <SegmentedControl
            label="Company"
            className="max-sm:w-full max-sm:*:flex-1"
            value={organisation ?? ""}
            options={ORGANISATION_SEGMENTS}
            onValueChange={(value) =>
              navigate(accountingHref(search, { organisation: value || null }))
            }
          />
        }
        loading={pending}
        filtered={props.filtered}
        error={
          props.loadError
            ? {
                title: "Accounting documents couldn't be loaded",
                description: props.loadError,
                onRetry: () => navigate(accountingHref(search, {})),
              }
            : null
        }
        empty={{ title: copy.title, description: copy.description }}
        noResults={{ noun: "documents" }}
        table={{
          label: "Accounting documents",
          columns,
          data: rows,
          getRowId: (row) => row.id,
          onRowOpen: (row) => setDetails(row),
          activeRowId: details?.id ?? null,
          // The first cell carries a second line, which needs 44px rows.
          defaultDensity: "comfortable",
          defaultHiddenColumns: ["created"],
          rowActions: {
            label: (row) => `Actions for ${row.documentType.toLowerCase()} ${row.reference}`,
            actions: (row) => rowMenuActions(row, { canAct, onTryAgain: askTryAgain }),
          },
        }}
        pageSize={{
          value: props.pageSize,
          onChange: (size) => navigate(accountingHref(search, { limit: size })),
        }}
        pagination={props.pagination}
      />
      <AccountingDetailsSheet
        row={details}
        canAct={canAct}
        onClose={() => setDetails(null)}
        onTryAgain={(row) => {
          setDetails(null);
          askTryAgain(row);
        }}
      />
      <ConfirmActionDialog
        open={confirming !== null}
        onOpenChange={(open) => {
          if (!open && !busy) setConfirming(null);
        }}
        title={dialogCopy?.title ?? ""}
        description={dialogCopy?.description ?? ""}
        confirmLabel={dialogCopy?.confirmLabel ?? "Try again"}
        loading={busy}
        confirmDisabled={lockedConfirm && !acknowledged}
        onConfirm={submit}
      >
        {lockedConfirm ? (
          <div className="flex items-start gap-2.5 text-staff-sm text-staff-fg">
            <StaffCheckbox
              id={acknowledgeId}
              checked={acknowledged}
              onCheckedChange={(next) => setAcknowledged(next === true)}
            />
            <label htmlFor={acknowledgeId}>{ACCOUNTING_LOCKED_PERIOD_ACKNOWLEDGEMENT}</label>
          </div>
        ) : null}
        {failure ? (
          <Notice tone="danger" alert title="The document was not sent again">
            {failure}
          </Notice>
        ) : null}
      </ConfirmActionDialog>
    </>
  );
}

/** The one line under the title: the source and when it last reached Books, or the rehearsal note. */
function SourceLine({
  lastSent,
  organisation,
}: {
  lastSent: AccountingLastSent | null;
  organisation: AccountingOrganisation | null;
}) {
  if (!lastSent) {
    return <>{ACCOUNTING_DESCRIPTION}</>;
  }
  if (lastSent.rehearsal) {
    return (
      <>
        Rehearsal only · last rehearsed <RelativeTime value={lastSent.at} />
      </>
    );
  }
  return (
    <>
      Zoho Books · {legalNamesForFilter(organisation)} · last sent{" "}
      <RelativeTime value={lastSent.at} />
    </>
  );
}

/** The row's main action as a button: try a failed one again, or open an issued one in Books. */
function RowAction({
  row,
  canAct,
  onTryAgain,
}: {
  row: AccountingStaffRow;
  canAct: boolean;
  onTryAgain: (row: AccountingStaffRow) => void;
}) {
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

type RowMenuDeps = { canAct: boolean; onTryAgain: (row: AccountingStaffRow) => void };

function rowMenuActions(row: AccountingStaffRow, { canAct, onTryAgain }: RowMenuDeps) {
  return [
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

/** Everything about one document, opened from a row: the full problem, dates and the action. */
function AccountingDetailsSheet({
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

/**
 * The phone's "Tried 2 times · last Thu 12 Nov, 09:30 GMT". Where the row's Try again button
 * narrows the column it wraps, first at the dot, rather than cutting the time off.
 */
function MetaLine({ row }: { row: AccountingStaffRow }) {
  const [tries, last] = rowMetaParts(row);
  return (
    <span data-meta-line className="whitespace-normal break-words">
      <span className="inline-block max-w-full">{tries} ·</span>{" "}
      <span className="inline-block max-w-full">{last}</span>
    </span>
  );
}

function ProblemCell({ row, issued }: { row: AccountingStaffRow; issued: boolean }) {
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
  // A failed document with no stored reason still reads as an answer from Books, not a blank.
  if (!row.problem) {
    const text = row.state.tone === "danger" ? ACCOUNTING_NO_REASON_TEXT : "None";
    return <span className="text-staff-muted">{text}</span>;
  }
  // Up to two lines, then an ellipsis; the whole reason is in the details sheet.
  return <span className="line-clamp-2 whitespace-normal">{row.problem}</span>;
}
