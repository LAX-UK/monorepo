"use client";

import { useStaffListNavigation } from "@/components/admin/staff/use-staff-list-navigation";
import {
  releaseAccountingDocumentAction,
  tryAgainAccountingDocumentAction,
} from "@/lib/actions/admin/admin-accounting";
import {
  ACCOUNTING_DESCRIPTION,
  ACCOUNTING_EMPTY_COPY,
  ACCOUNTING_REHEARSAL_NOTICE,
  type AccountingPartFundedRow,
  type AccountingSearch,
  type AccountingStaffRow,
  ORGANISATION_SEGMENTS,
  accountingHref,
  accountingTabs,
  legalNamesForFilter,
  lockedPeriodTitle,
  releaseCopy,
  releaseToast,
  rowMetaParts,
  tryAgainCopy,
  tryAgainToast,
} from "@/lib/admin/finance/accounting-queue.vm";
import { notify } from "@/lib/ui/notify";
import {
  ConfirmActionDialog,
  type DataColumn,
  DataViews,
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
  ACCOUNTING_PART_FUNDED_TEXT,
  ACCOUNTING_PART_FUNDED_TITLE,
  type AccountingLastSent,
  type AccountingOrganisation,
  type AccountingQueueTab,
} from "@auction/types";
import { useRouter } from "next/navigation";
import { useCallback, useId, useMemo, useState, useTransition } from "react";
import { AccountingDetailsSheet } from "./accounting-details-sheet";

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
  /** Bank transfers part received (Bid): listed for reconciliation, never sent to Books. */
  partFunded?: AccountingPartFundedRow[];
};

/**
 * Finance › Accounting on the staff list template: what LAX sends to Zoho Books for both
 * companies, one tab per stage (needs a person, failed, waiting, in Books). "Try again" sends the
 * same document under the same LAX reference, after a confirm; "Release" queues a parked one once
 * its reason is settled (the API checks that against the stored rows). Both are offered only to
 * people with the finance write permission and only where the document's state allows it. The header names the
 * source and when it last reached Books; a row opens a details sheet, and each row's main action
 * is a visible button as well as an entry in its … menu.
 */
export function AccountingQueueList(props: AccountingQueueListProps) {
  const { search, rows, tab, canAct, organisation } = props;
  const router = useRouter();
  const { pending, navigate, Link: ListLink } = useStaffListNavigation();
  const [confirming, setConfirming] = useState<{
    row: AccountingStaffRow;
    key: string;
    /** Try a refused document again, or release a parked one. */
    action: RowActionKind;
  } | null>(null);
  const [acknowledged, setAcknowledged] = useState(false);
  const [details, setDetails] = useState<AccountingStaffRow | null>(null);
  const [failure, setFailure] = useState<string | null>(null);
  const [busy, startTransition] = useTransition();
  const acknowledgeId = useId();

  const askTryAgain = useCallback((row: AccountingStaffRow) => {
    setFailure(null);
    setAcknowledged(false);
    setConfirming({ row, key: crypto.randomUUID(), action: "try_again" });
  }, []);
  const askRelease = useCallback((row: AccountingStaffRow) => {
    setFailure(null);
    setAcknowledged(false);
    setConfirming({ row, key: crypto.randomUUID(), action: "release" });
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
        // Wide enough for "Waiting for the accountant" on one line.
        width: "176px",
        mobile: "meta",
        truncate: false,
        cell: (row) => <StatusBadge tone={row.state.tone}>{row.state.label}</StatusBadge>,
      },
      {
        id: "problem",
        header: tab === "issued" ? "In Books" : "Last problem",
        minWidth: "180px", // matters most after Document, so it takes the spare room
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
        cell: (row) => (
          <RowAction row={row} canAct={canAct} onTryAgain={askTryAgain} onRelease={askRelease} />
        ),
      },
    ],
    [tab, canAct, askTryAgain, askRelease],
  );

  const copy = ACCOUNTING_EMPTY_COPY[tab];

  const submit = () => {
    if (!confirming) return;
    const { row, key, action } = confirming;
    setFailure(null);
    startTransition(async () => {
      const input = { documentId: row.id, idempotencyKey: key };
      const result =
        action === "release"
          ? await releaseAccountingDocumentAction(input)
          : await tryAgainAccountingDocumentAction(input);
      if (result.ok) {
        setConfirming(null);
        const outcome = result.data?.outcome;
        notify.success(
          action === "release"
            ? releaseToast(outcome === "already_queued" ? outcome : "released", row.reference)
            : tryAgainToast(outcome === "already_queued" ? outcome : "requeued", row.reference),
        );
        router.refresh();
        return;
      }
      setFailure(result.error);
    });
  };

  const dialogRow = confirming?.row ?? null;
  const releasing = confirming?.action === "release";
  const dialogCopy = dialogRow
    ? releasing
      ? releaseCopy(dialogRow)
      : tryAgainCopy(dialogRow)
    : null;
  const lockedConfirm = !releasing && Boolean(dialogRow?.lockedPeriod);
  const locked = rows.filter((row) => row.lockedPeriod).length;
  const partFunded = props.partFunded ?? [];
  const hasNotice =
    locked > 0 ||
    props.rehearsal ||
    props.unreadable > 0 ||
    props.referenceError !== null ||
    partFunded.length > 0;
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
      {partFunded.length > 0 ? <PartFundedNotice transfers={partFunded} /> : null}
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
            actions: (row) =>
              rowMenuActions(row, { canAct, onTryAgain: askTryAgain, onRelease: askRelease }),
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
        onRelease={(row) => {
          setDetails(null);
          askRelease(row);
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
          <Notice
            tone="danger"
            alert
            title={releasing ? "The document was not released" : "The document was not sent again"}
          >
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

type RowActionKind = "try_again" | "release";

/**
 * The row's main action as a button: try a failed one again, release a parked one, or open an
 * issued one in Books.
 */
function RowAction({
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

function rowMenuActions(row: AccountingStaffRow, { canAct, onTryAgain, onRelease }: RowMenuDeps) {
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

/**
 * Bank transfers that have partly arrived. Nothing is sent to Books for them: the payment goes once
 * the whole amount has arrived and been applied. Listed so finance can reconcile what is in the
 * bank against what is in the books.
 */
function PartFundedNotice({ transfers }: { transfers: AccountingPartFundedRow[] }) {
  return (
    <Notice tone="info" title={`${ACCOUNTING_PART_FUNDED_TITLE} (${transfers.length})`}>
      <p>{ACCOUNTING_PART_FUNDED_TEXT}</p>
      <ul className="mt-2 flex flex-col gap-1.5" aria-label={ACCOUNTING_PART_FUNDED_TITLE}>
        {transfers.map((t) => (
          <li key={t.reference} className="flex flex-wrap gap-x-2 break-words">
            <span className="font-medium text-staff-fg [overflow-wrap:anywhere]">
              {t.reference}
            </span>
            <span>
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
