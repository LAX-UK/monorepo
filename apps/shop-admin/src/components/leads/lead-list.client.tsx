"use client";

import { useListNavigation } from "@/components/use-list-navigation.client";
import {
  LEAD_CONSENT_LABEL,
  LEAD_CONSENT_OPTIONS,
  LEAD_CRM_OPTIONS,
  LEAD_SOURCE_OPTIONS,
  type LeadListQuery,
  hasActiveLeadFilters,
  leadActivitySummary,
  leadListHref,
  leadListPageHref,
  leadName,
  leadsCsv,
  presentLeadCrm,
  presentLeadStatus,
} from "@/server/domain/lead-list.vm";
import {
  ADMIN_LEAD_SEARCH_MAX_LENGTH,
  type AdminLeadListResponse,
  type AdminLeadSummary,
} from "@auction/shop-contracts";
import {
  GUEST_LEAD_CRM_STATE_LABEL,
  GUEST_LEAD_SOURCE_LABEL,
  GUEST_LEAD_TABS,
  GUEST_LEAD_TAB_LABEL,
  type GuestLeadCrmState,
  type GuestLeadSource,
} from "@auction/shop-domain";
import {
  type DataColumn,
  DataViews,
  FilterSheet,
  ListPage,
  PrimaryCell,
  STAFF_DEFAULT_PAGE_SIZE,
  StaffButton,
  StaffDate,
  StatusBadge,
  TableSearch,
  searchChipLabel,
  toast,
} from "@auction/staff-ui";
import { Download } from "@auction/staff-ui/icons";
import Link from "next/link";
import { useMemo, useState } from "react";

function download(filename: string, text: string) {
  const url = URL.createObjectURL(new Blob([text], { type: "text/csv;charset=utf-8" }));
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}

/**
 * Guest leads on the staff list template: tabs with counts, search by name or email, filters for
 * source, consent and CRM state as removable chips, CSV export, and a link to each lead.
 */
export function LeadList({
  query,
  page,
  now,
}: {
  query: LeadListQuery;
  page: AdminLeadListResponse;
  now: string;
}) {
  const { pending, navigate, Link: ListLink } = useListNavigation();
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const filtered = hasActiveLeadFilters(query);

  const views = GUEST_LEAD_TABS.map((tab) => ({
    id: tab,
    label: GUEST_LEAD_TAB_LABEL[tab],
    href: leadListHref(query, { tab: tab === "all" ? null : tab }),
    count: page.counts[tab] ?? 0,
  }));

  const exportRows = (rows: readonly AdminLeadSummary[]) => {
    download(`leads-${now.slice(0, 10)}.csv`, leadsCsv(rows));
    toast.success(`Exported ${rows.length} ${rows.length === 1 ? "lead" : "leads"}`);
  };

  const columns = useMemo<DataColumn<AdminLeadSummary>[]>(
    () => [
      {
        id: "lead",
        header: "Lead",
        mobile: "title",
        cell: (row) => (
          <PrimaryCell
            href={`/leads/${row.leadId}`}
            Link={Link}
            secondary={row.name ? row.email : undefined}
          >
            {leadName(row)}
          </PrimaryCell>
        ),
      },
      {
        id: "status",
        header: "Status",
        width: "168px",
        mobile: "badge",
        truncate: false,
        cell: (row) => {
          const status = presentLeadStatus(row);
          return <StatusBadge tone={status.tone}>{status.label}</StatusBadge>;
        },
      },
      {
        id: "source",
        header: "Source",
        width: "152px",
        hideBelow: "xl",
        mobile: "meta",
        cell: (row) => GUEST_LEAD_SOURCE_LABEL[row.source],
      },
      {
        id: "activity",
        header: "Orders and enquiries",
        width: "160px",
        mobile: "meta",
        cell: (row) => leadActivitySummary(row),
      },
      {
        id: "consent",
        header: "Consent",
        width: "120px",
        hideBelow: "xl",
        cell: (row) => (row.consent.given ? "Opted in" : "Not opted in"),
      },
      {
        id: "crm",
        header: "CRM",
        width: "112px",
        hideBelow: "lg",
        truncate: false,
        cell: (row) => {
          const crm = presentLeadCrm(row.crm);
          return <StatusBadge tone={crm.tone}>{crm.label}</StatusBadge>;
        },
      },
      {
        id: "lastSeen",
        header: "Last seen",
        width: "120px",
        sortable: true,
        sortValue: (row) => row.lastSeenAt,
        defaultSortDirection: "desc",
        mobile: "meta",
        truncate: false,
        cell: (row) => <StaffDate value={row.lastSeenAt} />,
      },
    ],
    [],
  );

  const activeFilters = [
    ...(query.q
      ? [
          {
            id: "q",
            label: searchChipLabel(query.q),
            onRemove: () => navigate(leadListHref(query, { q: null })),
          },
        ]
      : []),
    ...(query.source
      ? [
          {
            id: "source",
            label: `Source: ${GUEST_LEAD_SOURCE_LABEL[query.source]}`,
            onRemove: () => navigate(leadListHref(query, { source: null })),
          },
        ]
      : []),
    ...(query.consent
      ? [
          {
            id: "consent",
            label: LEAD_CONSENT_LABEL[query.consent],
            onRemove: () => navigate(leadListHref(query, { consent: null })),
          },
        ]
      : []),
    ...(query.crm
      ? [
          {
            id: "crm",
            label: `CRM: ${GUEST_LEAD_CRM_STATE_LABEL[query.crm]}`,
            onRemove: () => navigate(leadListHref(query, { crm: null })),
          },
        ]
      : []),
  ];

  return (
    <ListPage<AdminLeadSummary>
      title="Leads"
      description="People who checked out or enquired without a LAX account. A lead moves to Joined LAX when they open an account with the same email."
      Link={ListLink}
      listKey="leads"
      exportAction={
        page.items.length > 0 ? (
          <StaffButton
            size="sm"
            variant="secondary"
            icon={<Download aria-hidden />}
            onClick={() => exportRows(page.items)}
          >
            Export page
          </StaffButton>
        ) : null
      }
      views={<DataViews views={views} activeId={query.tab ?? "all"} Link={ListLink} />}
      search={
        <TableSearch
          key={query.q ?? ""}
          fullWidth
          label="Search leads"
          placeholder="Search by name or email"
          value={query.q ?? ""}
          onSearch={(q) =>
            navigate(leadListHref(query, { q: q.slice(0, ADMIN_LEAD_SEARCH_MAX_LENGTH) || null }))
          }
        />
      }
      filters={
        <FilterSheet
          title="Filter leads"
          sections={[
            {
              kind: "radio",
              id: "source",
              label: "Source",
              anyLabel: "Any source",
              options: LEAD_SOURCE_OPTIONS,
              value: query.source ?? "",
            },
            {
              kind: "radio",
              id: "consent",
              label: "Marketing consent",
              anyLabel: "Either",
              options: LEAD_CONSENT_OPTIONS,
              value: query.consent ?? "",
            },
            {
              kind: "radio",
              id: "crm",
              label: "CRM",
              anyLabel: "Any",
              options: LEAD_CRM_OPTIONS,
              value: query.crm ?? "",
            },
          ]}
          onApply={(values) =>
            navigate(
              leadListHref(query, {
                source: (values.source as GuestLeadSource | "") || null,
                consent: (values.consent as "given" | "not_given" | "") || null,
                crm: (values.crm as GuestLeadCrmState | "") || null,
              }),
            )
          }
        />
      }
      activeFilters={activeFilters}
      onClearFilters={() => navigate(leadListHref({ ...(query.tab ? { tab: query.tab } : {}) }))}
      loading={pending}
      filtered={filtered}
      empty={{
        illustration: "plinth",
        title: "No leads yet",
        description:
          "Leads appear when someone checks out as a guest or sends an enquiry without a LAX account.",
      }}
      noResults={{ noun: "leads" }}
      table={{
        columns,
        data: page.items,
        getRowId: (row) => row.leadId,
        // Consent is in the Display menu and in the export; the lead's name needs the room.
        defaultHiddenColumns: ["consent"],
        defaultDensity: "comfortable",
        defaultSort: { columnId: "lastSeen", direction: "desc" },
        onRowOpen: (row) => navigate(`/leads/${row.leadId}`),
        selectedIds: selected,
        onSelectedIdsChange: setSelected,
        bulkNoun: { one: "lead", other: "leads" },
        bulkActions: (rows) => (
          <StaffButton
            size="sm"
            variant="ghost"
            icon={<Download aria-hidden />}
            onClick={() => exportRows(rows)}
          >
            Export CSV
          </StaffButton>
        ),
        rowActions: {
          label: (row) => `Actions for ${leadName(row)}`,
          actions: (row) => [
            { id: "open", label: "Open lead", href: `/leads/${row.leadId}` },
            {
              id: "copy",
              label: "Copy email",
              onSelect: () => {
                void navigator.clipboard
                  ?.writeText(row.email)
                  .then(() => toast.success("Email copied"));
              },
            },
          ],
        },
      }}
      pageSize={{
        value: query.limit ? Number(query.limit) : STAFF_DEFAULT_PAGE_SIZE,
        onChange: (size) =>
          navigate(
            leadListHref(query, { limit: size === STAFF_DEFAULT_PAGE_SIZE ? null : String(size) }),
          ),
      }}
      pagination={
        page.items.length > 0
          ? {
              summary: `${page.items.length} ${page.items.length === 1 ? "lead" : "leads"} on this page`,
              prevHref: query.cursor ? leadListHref(query) : null,
              prevLabel: "First page",
              nextHref: page.nextCursor ? leadListPageHref(query, page.nextCursor) : null,
            }
          : null
      }
    />
  );
}
