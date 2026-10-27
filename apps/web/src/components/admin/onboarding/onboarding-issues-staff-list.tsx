"use client";

import { OnboardingIssueQuickView } from "@/components/admin/onboarding/onboarding-issue-quick-view";
import { useStaffListNavigation } from "@/components/admin/staff/use-staff-list-navigation";
import {
  ONBOARDING_TAB_LABELS,
  type OnboardingListSearch,
  type OnboardingStaffRow,
  onboardingEmptyCopy,
  onboardingListHref,
  onboardingMetrics,
  onboardingViews,
} from "@/lib/admin/onboarding-issues-staff-list.vm";
import type { AdminOnboardingIssuesLensSummary } from "@/lib/data/http/admin-onboarding-issues.shared";
import type {
  OnboardingQueueSummary,
  OnboardingTabId,
} from "@/lib/data/view-models/admin-onboarding-issues.vm";
import {
  type DataColumn,
  DataViews,
  ListPage,
  Notice,
  PrimaryCell,
  StaffButton,
  StaffDate,
  StatusBadge,
} from "@auction/staff-ui";
import Link from "next/link";
import { useMemo, useState } from "react";

export type OnboardingIssuesStaffListProps = {
  search: OnboardingListSearch;
  tab: OnboardingTabId;
  rows: OnboardingStaffRow[];
  /** The item named by `?item=` when it is not on this page. */
  selected: OnboardingStaffRow | null;
  selectedId: string | null;
  previewDegraded: boolean;
  queueSummary: OnboardingQueueSummary;
  lensSummary: AdminOnboardingIssuesLensSummary | null;
  offset: number;
  total: number;
  pageSize: number;
  pagination: { summary: string; prevHref: string | null; nextHref: string | null } | null;
  loadError: string | null;
};

const TITLE_HEADERS: Record<OnboardingTabId, string> = {
  entities: "Entity",
  artists: "Artist",
  kyc: "Client",
  orgs: "Organisation",
  documents: "Entity",
};

const URGENCY = {
  attention: { tone: "warning", label: "Aging" },
  stale: { tone: "danger", label: "Stale" },
} as const;

/** Where the person is with the item: how long it has waited, flagged once it is overdue. */
function WaitingCell({ row }: { row: OnboardingStaffRow }) {
  if (!row.ageLabel) return null;
  const urgency = row.urgency === "none" ? null : URGENCY[row.urgency];
  return (
    <span className="inline-flex items-center gap-2">
      <span className="tabular-nums">{row.ageLabel}</span>
      {urgency ? <StatusBadge tone={urgency.tone}>{urgency.label}</StatusBadge> : null}
    </span>
  );
}

/**
 * Bid's onboarding issues on the staff list template: the five queues of items waiting on staff
 * (entities, artists, KYC sessions, lead organisations and documents) as tabs with counts. A row
 * opens a panel with the item and the record page that settles it; the decisions themselves are
 * made on those pages.
 */
export function OnboardingIssuesStaffList(props: OnboardingIssuesStaffListProps) {
  const { search, rows, tab } = props;
  const { pending, navigate, Link: ListLink } = useStaffListNavigation();
  const [openId, setOpenId] = useState<string | null>(props.selectedId);

  const columns = useMemo<DataColumn<OnboardingStaffRow>[]>(
    () => [
      {
        id: "title",
        header: TITLE_HEADERS[tab],
        mobile: "title",
        cell: (row) => (
          <PrimaryCell href={row.href} Link={Link} secondary={row.secondary}>
            {row.title}
          </PrimaryCell>
        ),
      },
      ...(tab === "entities" || tab === "kyc"
        ? ([
            {
              id: "status",
              header: "Status",
              width: "168px",
              mobile: "badge",
              truncate: false,
              cell: (row) =>
                row.status ? (
                  <StatusBadge tone={row.status.tone}>{row.status.label}</StatusBadge>
                ) : null,
            },
          ] satisfies DataColumn<OnboardingStaffRow>[])
        : []),
      {
        id: "waiting",
        header: "Waiting",
        width: "152px",
        sortable: true,
        sortValue: (row) => row.since,
        defaultSortDirection: "asc",
        mobile: "meta",
        truncate: false,
        cell: (row) => <WaitingCell row={row} />,
      },
      {
        id: "created",
        header: tab === "documents" ? "Uploaded" : "Created",
        width: "120px",
        hideBelow: "md",
        mobile: "hidden",
        truncate: false,
        cell: (row) => <StaffDate value={row.since} />,
      },
    ],
    [tab],
  );

  const openRow =
    rows.find((row) => row.id === openId) ??
    (props.selected && props.selected.id === openId ? props.selected : null);
  const openIndex = openRow ? rows.findIndex((row) => row.id === openRow.id) : -1;
  const previous = openIndex > 0 ? rows[openIndex - 1] : undefined;
  const next = openIndex >= 0 ? rows[openIndex + 1] : undefined;
  const metrics = onboardingMetrics(props.lensSummary);
  const empty = onboardingEmptyCopy(tab, props.queueSummary.queueTotal);
  const linkClass = "underline underline-offset-2 hover:text-staff-fg";

  return (
    <>
      {props.previewDegraded ? (
        <Notice
          tone="warning"
          className="mb-4"
          title="That item is no longer in the onboarding queues"
          actions={
            <StaffButton asChild variant="secondary" size="sm">
              <Link
                href={onboardingListHref(search, {
                  item: null,
                  offset: typeof search.offset === "string" ? search.offset : null,
                })}
              >
                Show the list
              </Link>
            </StaffButton>
          }
        >
          It may have been resolved already.
        </Notice>
      ) : null}
      <ListPage<OnboardingStaffRow>
        title="Onboarding issues"
        description={
          <>
            Entities, artists, KYC sessions, lead organisations and documents waiting on staff. See
            also{" "}
            <Link href="/admin/legal-entities" className={linkClass}>
              legal entities
            </Link>
            ,{" "}
            <Link href="/admin/invitations" className={linkClass}>
              invitations
            </Link>{" "}
            and{" "}
            <Link href="/admin/clients" className={linkClass}>
              clients
            </Link>
            .
          </>
        }
        Link={ListLink}
        listKey="bid-admin.onboarding-issues"
        {...(metrics.length > 0
          ? {
              metrics: {
                label: `${ONBOARDING_TAB_LABELS[tab]} summary`,
                period: "Items waiting in this queue",
                items: metrics,
              },
            }
          : {})}
        views={
          <DataViews
            views={onboardingViews(search, props.queueSummary)}
            activeId={tab}
            Link={ListLink}
          />
        }
        loading={pending}
        filtered={false}
        noResults={{ noun: "issues" }}
        error={
          props.loadError
            ? {
                description: props.loadError,
                onRetry: () => navigate(onboardingListHref(search, {})),
              }
            : null
        }
        empty={empty}
        table={{
          columns,
          data: rows,
          getRowId: (row) => row.id,
          // The first cell carries a second line, which needs 44px rows.
          defaultDensity: "comfortable",
          defaultSort: { columnId: "waiting", direction: "asc" },
          onRowOpen: (row) => setOpenId(row.id),
          activeRowId: openId,
          rowActions: {
            label: (row) => `Actions for ${row.title}`,
            actions: (row) => [
              { id: "open", label: "Open details", onSelect: () => setOpenId(row.id) },
              { id: "full-page", label: row.hrefLabel, href: row.href },
            ],
          },
        }}
        pageSize={{
          value: props.pageSize,
          onChange: (size) => navigate(onboardingListHref(search, { limit: size })),
        }}
        pagination={props.pagination}
      />
      <OnboardingIssueQuickView
        row={openRow}
        position={
          openIndex >= 0 ? { index: props.offset + openIndex + 1, total: props.total } : null
        }
        onClose={() => setOpenId(null)}
        onPrevious={previous ? () => setOpenId(previous.id) : null}
        onNext={next ? () => setOpenId(next.id) : null}
      />
    </>
  );
}
