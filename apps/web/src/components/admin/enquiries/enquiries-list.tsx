"use client";

import { useStaffListNavigation } from "@/components/admin/staff/use-staff-list-navigation";
import {
  type EnquiriesFilterChip,
  type EnquiriesFilters,
  type EnquiriesSearch,
  enquiriesHref,
  enquiryHref,
} from "@/lib/admin/enquiries/enquiries-search";
import {
  ENQUIRIES_PATH,
  ENQUIRY_EMPTY_COPY,
  ENQUIRY_KIND_LABELS,
  ENQUIRY_ORDER_NOTE,
  ENQUIRY_STATUS_LABELS,
  ENQUIRY_VIEW_IDS,
  ENQUIRY_VIEW_LABELS,
  enquiryWaiting,
  humaniseSlug,
} from "@/lib/admin/enquiries/enquiries.vm";
import type { EnquiryAbilities } from "@/lib/admin/enquiries/enquiry-access";
import { routingRows } from "@/lib/admin/enquiries/enquiry-routing-rows";
import type {
  EnquiryAssignee,
  EnquiryListItem,
  EnquiryListPage,
  EnquiryRule,
} from "@/lib/data/http/admin-enquiries.schema";
import { copyToClipboard } from "@/lib/ui/copy-to-clipboard";
import {
  type DataColumn,
  DataViews,
  FilterSheet,
  ListPage,
  type OverflowAction,
  PrimaryCell,
  StackedCell,
  StaffButton,
} from "@auction/staff-ui";
import { Route } from "@auction/staff-ui/icons";
import Link from "next/link";
import { useCallback, useMemo, useState } from "react";
import { AssigneeCell, EnquiryStatusBadge, WaitingCell } from "./enquiry-cells";
import { RoutingDialog } from "./routing-dialog";

export type EnquiriesListProps = {
  page: EnquiryListPage | null;
  search: EnquiriesSearch;
  filters: EnquiriesFilters;
  chips: EnquiriesFilterChip[];
  assignees: EnquiryAssignee[];
  /** The routing table, loaded only for people who can change it. */
  routing: EnquiryRule[] | null;
  abilities: EnquiryAbilities;
  pagination: { summary: string; prevHref: string | null; nextHref: string | null } | null;
  loadError: string | null;
  filtered: boolean;
  /** The server's clock, so waiting times match between server and browser. */
  now: string;
};

const KIND_OPTIONS = Object.entries(ENQUIRY_KIND_LABELS).map(([value, label]) => ({
  value,
  label,
}));
const STATUS_OPTIONS = Object.entries(ENQUIRY_STATUS_LABELS).map(([value, label]) => ({
  value,
  label,
}));

/**
 * Every enquiry from the contact form and the private sales page on the staff list template.
 * It opens on the person's own queue (specialists) or on everything open, longest waiting first.
 * Emails are masked here; the record shows them in full. The order is the view's own, so there is
 * no sort control. Routing, for the people who may change it, opens from the header.
 */
export function EnquiriesList(props: EnquiriesListProps) {
  const { page, search, filters, abilities } = props;
  const { pending, navigate, Link: ListLink } = useStaffListNavigation();
  const [routingOpen, setRoutingOpen] = useState(false);
  const now = useMemo(() => new Date(props.now), [props.now]);
  const rows = page?.items ?? [];
  const defaultView = abilities.defaultView;

  const nameOf = useCallback(
    (userId: string) => props.assignees.find((person) => person.id === userId)?.name,
    [props.assignees],
  );
  const href = useCallback(
    (patch: Record<string, string | null>) => enquiriesHref(search, patch, defaultView),
    [search, defaultView],
  );

  const departmentOptions = useMemo(
    () =>
      routingRows([])
        .filter((row) => row.slug !== null)
        .map((row) => ({ value: row.slug as string, label: row.label })),
    [],
  );

  const columns = useMemo<DataColumn<EnquiryListItem>[]>(
    () => [
      {
        id: "client",
        header: "Client",
        width: "30%",
        mobile: "title",
        cell: (row) => (
          <PrimaryCell
            href={enquiryHref(row.reference)}
            Link={Link}
            unread={row.status === "new"}
            secondary={
              <span className="tabular-nums">
                {row.reference} · {row.maskedEmail} · {row.hasAccount ? "Account" : "Guest"}
              </span>
            }
          >
            {row.name}
          </PrimaryCell>
        ),
      },
      {
        id: "kind",
        header: "Kind",
        width: "22%",
        hideBelow: "lg",
        mobile: "meta",
        cell: (row) => (
          <StackedCell
            secondary={row.departmentSlug ? humaniseDepartment(row.departmentSlug) : undefined}
          >
            {row.topicLabel}
          </StackedCell>
        ),
      },
      {
        id: "assignee",
        header: "Assignee",
        width: "18%",
        hideBelow: "xl",
        mobile: "hidden",
        cell: (row) => <AssigneeCell userId={row.assignedToUserId} nameOf={nameOf} />,
      },
      {
        id: "waiting",
        header: "Waiting",
        width: "128px",
        mobile: "meta",
        truncate: false,
        cell: (row) => <WaitingCell waiting={enquiryWaiting(row, now)} />,
      },
      {
        id: "status",
        header: "Status",
        width: "150px",
        hideBelow: "md",
        mobile: "badge",
        truncate: false,
        cell: (row) => <EnquiryStatusBadge status={row.status} />,
      },
    ],
    [nameOf, now],
  );

  const actionsFor = useCallback(
    (row: EnquiryListItem): OverflowAction[] => [
      { id: "open", label: "Open", href: enquiryHref(row.reference) },
      {
        id: "copy",
        label: "Copy reference",
        onSelect: () => copyToClipboard(row.reference, "Reference"),
      },
    ],
    [],
  );

  const empty = ENQUIRY_EMPTY_COPY[filters.view];
  const assigneeOptions = [
    { value: "unassigned", label: "Unassigned" },
    ...props.assignees.map((person) => ({ value: person.id, label: person.name })),
  ];

  return (
    <>
      <ListPage<EnquiryListItem>
        title="Enquiries"
        description="Every enquiry from lax.bid. Each gets a reply within two business days."
        Link={ListLink}
        listKey="bid-admin.enquiries"
        access="full"
        {...(abilities.canRoute && props.routing
          ? {
              secondaryActions: (
                <StaffButton
                  variant="secondary"
                  icon={<Route aria-hidden />}
                  onClick={() => setRoutingOpen(true)}
                >
                  Routing
                </StaffButton>
              ),
            }
          : {})}
        views={
          <DataViews
            views={ENQUIRY_VIEW_IDS.map((id) => ({
              id,
              label: ENQUIRY_VIEW_LABELS[id],
              href: href({ view: id }),
            }))}
            activeId={filters.view}
            Link={ListLink}
          />
        }
        filters={
          <FilterSheet
            title="Filter enquiries"
            sections={[
              {
                kind: "radio",
                id: "kind",
                label: "Kind",
                value: filters.kind,
                anyLabel: "Any kind",
                options: KIND_OPTIONS,
              },
              {
                kind: "radio",
                id: "department",
                label: "Department",
                value: filters.department,
                anyLabel: "Any department",
                options: departmentOptions,
              },
              {
                kind: "radio",
                id: "status",
                label: "Status",
                value: filters.status,
                anyLabel: "Any status",
                options: STATUS_OPTIONS,
              },
              {
                kind: "radio",
                id: "assignee",
                label: "Assignee",
                value: filters.assignee,
                anyLabel: "Anyone",
                options: assigneeOptions,
              },
            ]}
            onApply={(values) =>
              navigate(
                href({
                  kind: (values.kind as string) || null,
                  department: (values.department as string) || null,
                  status: (values.status as string) || null,
                  assignee: (values.assignee as string) || null,
                }),
              )
            }
          />
        }
        activeFilters={props.chips.map((chip) => ({
          id: chip.id,
          label: chip.label,
          onRemove: () => navigate(chip.clearHref),
        }))}
        onClearFilters={() =>
          navigate(href({ kind: null, department: null, status: null, assignee: null }))
        }
        loading={pending}
        filtered={props.filtered}
        error={
          props.loadError
            ? {
                title: "Enquiries couldn't be loaded",
                description: props.loadError,
                onRetry: () => navigate(`${ENQUIRIES_PATH}${window.location.search}`),
              }
            : null
        }
        empty={{
          title: empty.title,
          description: empty.description,
          ...(filters.view === defaultView && filters.view !== "all"
            ? {
                action: (
                  <StaffButton
                    size="sm"
                    variant="secondary"
                    onClick={() => navigate(href({ view: "all" }))}
                  >
                    View all enquiries
                  </StaffButton>
                ),
              }
            : {}),
        }}
        noResults={{ noun: "enquiries" }}
        table={{
          columns,
          data: rows,
          getRowId: (row) => row.reference,
          defaultDensity: "comfortable",
          onRowOpen: (row) => navigate(enquiryHref(row.reference)),
          rowActions: {
            label: (row) => `Actions for ${row.reference}, ${row.name}`,
            actions: actionsFor,
          },
        }}
        pagination={
          props.pagination
            ? {
                ...props.pagination,
                summary: `${props.pagination.summary} · ${ENQUIRY_ORDER_NOTE[filters.view]}`,
              }
            : null
        }
      />
      {abilities.canRoute && props.routing ? (
        <RoutingDialog
          open={routingOpen}
          onOpenChange={setRoutingOpen}
          rules={props.routing}
          assignees={props.assignees}
        />
      ) : null}
    </>
  );
}

function humaniseDepartment(slug: string): string {
  return routingRows([]).find((row) => row.slug === slug)?.label ?? humaniseSlug(slug);
}
