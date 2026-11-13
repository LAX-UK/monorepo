"use client";

import { useStaffListNavigation } from "@/components/admin/staff/use-staff-list-navigation";
import { tryAgainAccountingDocumentAction } from "@/lib/actions/admin/admin-accounting";
import {
  ACCOUNTING_DESCRIPTION,
  ACCOUNTING_EMPTY_COPY,
  ACCOUNTING_REHEARSAL_NOTICE,
  type AccountingSearch,
  type AccountingStaffRow,
  ORGANISATION_FILTERS,
  accountingFilterChips,
  accountingHref,
  accountingTabs,
  lockedPeriodTitle,
  tryAgainCopy,
  tryAgainToast,
} from "@/lib/admin/finance/accounting-queue.vm";
import { notify } from "@/lib/ui/notify";
import {
  ConfirmActionDialog,
  type DataColumn,
  DataViews,
  FilterSheet,
  ListPage,
  Notice,
  PrimaryCell,
  StaffDate,
  StatusBadge,
  TextLink,
} from "@auction/staff-ui";
import { ACCOUNTING_LOCKED_PERIOD_TEXT } from "@auction/types";
import type { AccountingQueueTab } from "@auction/types";
import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";

export type AccountingQueueListProps = {
  search: AccountingSearch;
  tab: AccountingQueueTab;
  rows: AccountingStaffRow[];
  counts: Record<AccountingQueueTab, number>;
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
 * companies, one tab per stage (needs a person, refused, waiting, in Books). "Try again" sends the
 * same document under the same LAX reference, after a confirm; it is offered only to people with
 * the finance write permission and only where the document's state allows it.
 */
export function AccountingQueueList(props: AccountingQueueListProps) {
  const { search, rows, tab, canAct } = props;
  const router = useRouter();
  const { pending, navigate, Link: ListLink } = useStaffListNavigation();
  const [confirming, setConfirming] = useState<{ row: AccountingStaffRow; key: string } | null>(
    null,
  );
  const [failure, setFailure] = useState<string | null>(null);
  const [busy, startTransition] = useTransition();
  const organisation = typeof search.organisation === "string" ? search.organisation : "";

  const columns = useMemo<DataColumn<AccountingStaffRow>[]>(
    () => [
      {
        id: "document",
        header: "Document",
        width: "19%",
        mobile: "title",
        cell: (row) => <PrimaryCell secondary={row.kind}>{row.reference}</PrimaryCell>,
      },
      {
        id: "state",
        header: "Status",
        width: "148px",
        mobile: "badge",
        truncate: false,
        cell: (row) => <StatusBadge tone={row.state.tone}>{row.state.label}</StatusBadge>,
      },
      {
        id: "problem",
        header: tab === "issued" ? "In Books" : "Last problem",
        mobile: "meta",
        cell: (row) => <ProblemCell row={row} issued={tab === "issued"} />,
      },
      {
        id: "company",
        header: "Company",
        width: "15%",
        hideBelow: "lg",
        mobile: "hidden",
        cell: (row) => row.company,
      },
      {
        id: "amount",
        header: "Amount",
        width: "112px",
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
        width: "96px",
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
        width: "120px",
        sortable: true,
        sortValue: (row) => Date.parse(row.updatedAt),
        defaultSortDirection: "desc",
        hideBelow: "md",
        mobile: "hidden",
        truncate: false,
        cell: (row) => <StaffDate value={row.updatedAt} />,
      },
      {
        id: "created",
        header: "Created",
        width: "120px",
        sortable: true,
        sortValue: (row) => Date.parse(row.createdAt),
        defaultSortDirection: "desc",
        hideBelow: "xl",
        mobile: "hidden",
        truncate: false,
        cell: (row) => <StaffDate value={row.createdAt} />,
      },
    ],
    [tab],
  );

  const chips = accountingFilterChips(search).map((chip) => ({
    id: chip.id,
    label: chip.label,
    onRemove: () => navigate(chip.clearHref),
  }));
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

  const dialogCopy = confirming ? tryAgainCopy(confirming.row) : null;
  const locked = rows.filter((row) => row.lockedPeriod).length;
  const notices = (
    <>
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
        description={ACCOUNTING_DESCRIPTION}
        Link={ListLink}
        listKey="bid-admin.accounting"
        access={canAct ? "full" : "read-only"}
        notice={locked > 0 || props.rehearsal || props.unreadable > 0 ? notices : undefined}
        views={
          <DataViews views={accountingTabs(search, props.counts)} activeId={tab} Link={ListLink} />
        }
        filters={
          <FilterSheet
            title="Filter documents"
            description="The stage is set by the tabs above the list."
            sections={[
              {
                kind: "radio",
                id: "organisation",
                label: "Company",
                anyLabel: "Both companies",
                options: ORGANISATION_FILTERS,
                value: organisation,
              },
            ]}
            onApply={(values) =>
              navigate(
                accountingHref(search, {
                  organisation: (values.organisation as string) || null,
                }),
              )
            }
          />
        }
        activeFilters={chips}
        onClearFilters={() => navigate(accountingHref(search, { organisation: null }))}
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
          // The first cell carries a second line, which needs 44px rows.
          defaultDensity: "comfortable",
          defaultHiddenColumns: ["created"],
          rowActions: {
            label: (row) => `Actions for ${row.documentType.toLowerCase()} ${row.reference}`,
            actions: (row) => [
              ...(canAct && row.canTryAgain
                ? [
                    {
                      id: "try-again",
                      label: "Try again",
                      onSelect: () => {
                        setFailure(null);
                        setConfirming({ row, key: crypto.randomUUID() });
                      },
                    },
                  ]
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
            ],
          },
        }}
        pageSize={{
          value: props.pageSize,
          onChange: (size) => navigate(accountingHref(search, { limit: size })),
        }}
        pagination={props.pagination}
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
        onConfirm={submit}
      >
        {failure ? (
          <Notice tone="danger" alert title="The document was not sent again">
            {failure}
          </Notice>
        ) : null}
      </ConfirmActionDialog>
    </>
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
  if (!row.problem) return <span className="text-staff-muted">None</span>;
  return row.problem;
}
