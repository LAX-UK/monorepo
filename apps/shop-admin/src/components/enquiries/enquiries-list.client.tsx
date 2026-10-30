"use client";

import { useStaffCatalogueImage } from "@/components/artworks/staff-catalogue-image-provider.client";
import {
  type EnquiryTarget,
  useEnquiryActions,
} from "@/components/enquiries/use-enquiry-actions.client";
import { filterChip, knownFacts, useWorkList } from "@/components/use-work-list.client";
import {
  ENQUIRY_ASSIGNEE_LABELS,
  ENQUIRY_KIND_LABELS,
  ENQUIRY_TOPIC_LABELS,
  type EnquiriesListState,
  enquiriesList,
  enquiryPath,
  enquiryRef,
  enquirySenderName,
  enquirySenderSecondary,
  enquiryStaffName,
  parseEnquiryRef,
} from "@/server/domain/enquiry-inbox.vm";
import { presentStatus } from "@/server/domain/staff-status";
import {
  type AdminEnquiryListItem,
  type AdminEnquiryListResponse,
  ENQUIRY_KINDS,
  ENQUIRY_TOPICS,
  type EnquiryAssignee,
} from "@auction/shop-contracts";
import {
  CellThumbnail,
  type DataColumn,
  DetailPanel,
  FilterSheet,
  ListPage,
  MappedStatusBadge,
  type OverflowAction,
  OverflowMenu,
  PersonCell,
  StaffButton,
  StaffDate,
  StaffDialog,
  formatStaffDateTime,
} from "@auction/staff-ui";
import { MessageSquareText } from "@auction/staff-ui/icons";
import Link from "next/link";
import { useMemo } from "react";

const presentEnquiryStatus = presentStatus("enquiry");

const noun = { one: "enquiry", other: "enquiries" };

function aboutLabel(item: Pick<AdminEnquiryListItem, "artwork" | "topic">): string {
  return item.artwork?.title ?? ENQUIRY_TOPIC_LABELS[item.topic];
}

function assigneeLabel(item: Pick<AdminEnquiryListItem, "assignee">): string {
  return item.assignee ? enquiryStaffName(item.assignee) : "Unassigned";
}

function toTarget(item: AdminEnquiryListItem): EnquiryTarget {
  return {
    kind: item.kind,
    id: item.id,
    version: item.version,
    status: item.status,
    assignee: item.assignee,
    sender: item.sender,
  };
}

/**
 * The enquiries inbox on the staff list template: Waiting first by default, a view per status
 * with counts, search by sender or message, kind, topic and assignee filters, and a record panel
 * linked from the URL (`?enquiry=kind:id`). The server orders waiting enquiries first and then by
 * when they were received. The row menu opens the conversation, takes or hands back an enquiry
 * (with Undo), and closes or reopens it.
 */
export function EnquiriesList({
  state,
  page,
  currentSubject,
  assignees = [],
  canWrite,
  loadFailed = false,
}: {
  state: EnquiriesListState;
  page: AdminEnquiryListResponse;
  currentSubject: string;
  /** Staff who can handle enquiries, offered by name in the assignee filter. */
  assignees?: readonly EnquiryAssignee[];
  canWrite: boolean;
  loadFailed?: boolean;
}) {
  const list = useWorkList({
    list: enquiriesList,
    state,
    page,
    noun,
    search: { label: "Search enquiries", placeholder: "Search by sender or message" },
  });
  const actions = useEnquiryActions({ currentSubject });
  const resolveImage = useStaffCatalogueImage();
  const openRef = parseEnquiryRef(list.panel.openId);
  const opened = openRef
    ? (page.items.find((item) => item.kind === openRef.kind && item.id === openRef.id) ?? null)
    : null;

  const columns = useMemo<DataColumn<AdminEnquiryListItem>[]>(
    () => [
      {
        id: "sender",
        header: "Sender",
        mobile: "title",
        truncate: false,
        cell: (row) => (
          <PersonCell
            name={enquirySenderName(row.sender)}
            secondary={enquirySenderSecondary(row.sender)}
            href={list.panelHref(enquiryRef(row))}
            Link={list.panel.PanelLink}
          />
        ),
      },
      {
        id: "about",
        header: "About",
        width: "26%",
        mobile: "meta",
        truncate: false,
        cell: (row) =>
          row.artwork ? (
            <span className="flex min-w-0 items-center gap-3">
              <CellThumbnail src={resolveImage(row.artwork.thumbnailUrl)} />
              <span className="truncate">{row.artwork.title}</span>
            </span>
          ) : (
            ENQUIRY_TOPIC_LABELS[row.topic]
          ),
      },
      {
        id: "status",
        header: "Status",
        width: "136px",
        mobile: "badge",
        truncate: false,
        cell: (row) => <MappedStatusBadge status={row.status} present={presentEnquiryStatus} />,
      },
      {
        id: "assignee",
        header: "Assigned to",
        width: "20%",
        hideBelow: "lg",
        mobile: "hidden",
        cell: (row) => assigneeLabel(row),
      },
      {
        id: "received",
        header: "Received",
        width: "184px",
        sortable: true,
        defaultSortDirection: "desc",
        mobile: "meta",
        truncate: false,
        cell: (row) => <StaffDate value={row.createdAt} withTime />,
      },
    ],
    [list.panelHref, list.panel.PanelLink, resolveImage],
  );

  const kindChip = filterChip(
    enquiriesList,
    state,
    list.navigate,
    "kind",
    (value) => `Type: ${ENQUIRY_KIND_LABELS[value as keyof typeof ENQUIRY_KIND_LABELS]}`,
  );
  const topicChip = filterChip(
    enquiriesList,
    state,
    list.navigate,
    "topic",
    (value) => `Topic: ${ENQUIRY_TOPIC_LABELS[value as keyof typeof ENQUIRY_TOPIC_LABELS]}`,
  );
  const colleagues = assignees.filter((person) => person.subject !== currentSubject);
  const assigneeChip = filterChip(enquiriesList, state, list.navigate, "assignee", (value) => {
    if (value === "me") return "Assigned to me";
    if (value === "unassigned") return ENQUIRY_ASSIGNEE_LABELS.unassigned;
    const person = assignees.find((candidate) => candidate.subject === value);
    return `Assigned to ${person ? enquiryStaffName(person) : "a colleague"}`;
  });

  const rowMenu = (row: AdminEnquiryListItem): OverflowAction[] => [
    {
      id: "open",
      label: "Open conversation",
      icon: MessageSquareText,
      href: enquiryPath(row),
    },
    ...(canWrite ? actions.actionsFor(toTarget(row)) : []),
  ];

  return (
    <>
      <ListPage<AdminEnquiryListItem>
        title="Enquiries"
        description="Messages from lax.art and questions about artworks. Pick one up, keep notes, and close it when it is dealt with."
        Link={list.Link}
        listKey="lax-admin.enquiries"
        views={list.views}
        search={list.search}
        filters={
          <FilterSheet
            title="Filter enquiries"
            sections={[
              {
                kind: "radio",
                id: "kind",
                label: "Type",
                anyLabel: "Any type",
                options: ENQUIRY_KINDS.map((value) => ({
                  value,
                  label: ENQUIRY_KIND_LABELS[value],
                })),
                value: state.filters.kind ?? "",
              },
              {
                kind: "radio",
                id: "topic",
                label: "Topic",
                anyLabel: "Any topic",
                options: ENQUIRY_TOPICS.map((value) => ({
                  value,
                  label: ENQUIRY_TOPIC_LABELS[value],
                })),
                value: state.filters.topic ?? "",
              },
              {
                kind: "radio",
                id: "assignee",
                label: "Assigned to",
                anyLabel: "Anyone",
                options: [
                  { value: "me", label: "Me" },
                  { value: "unassigned", label: "Unassigned" },
                  ...colleagues.map((person) => ({
                    value: person.subject,
                    label: enquiryStaffName(person),
                  })),
                ],
                value: state.filters.assignee ?? "",
              },
            ]}
            onApply={(values) =>
              list.navigate(
                enquiriesList.href(state, {
                  kind: (values.kind as string) || null,
                  topic: (values.topic as string) || null,
                  assignee: (values.assignee as string) || null,
                }),
              )
            }
          />
        }
        activeFilters={[...list.searchChip, ...kindChip, ...topicChip, ...assigneeChip]}
        onClearFilters={list.clearFilters}
        loading={list.pending}
        filtered={list.filtered}
        error={
          loadFailed
            ? {
                title: "Enquiries did not load",
                description: "Something went wrong on our side. Try again in a moment.",
                onRetry: () => list.navigate(enquiriesList.href(state)),
              }
            : null
        }
        empty={
          state.view === "new"
            ? {
                illustration: "plinth",
                title: "No enquiries waiting",
                description: "New messages from lax.art and artwork pages appear here.",
              }
            : state.view === "all"
              ? {
                  illustration: "plinth",
                  title: "No enquiries yet",
                  description:
                    "Messages from the lax.art contact forms and artwork enquiries appear here.",
                }
              : {
                  illustration: "plinth",
                  title: "No enquiries here",
                  description: "Enquiries move here as they are picked up and closed.",
                }
        }
        noResults={{ noun: "enquiries" }}
        table={{
          columns,
          data: page.items,
          getRowId: enquiryRef,
          defaultDensity: "comfortable",
          ...list.sort,
          onRowOpen: (row) => list.panel.show(enquiryRef(row)),
          activeRowId: list.panel.openId,
          rowActions: {
            label: (row) => `Actions for the enquiry from ${enquirySenderName(row.sender)}`,
            actions: rowMenu,
          },
        }}
        pageSize={list.pageSize}
        pagination={list.pagination}
      />

      <DetailPanel
        open={opened !== null}
        onOpenChange={(open) => {
          if (!open) list.panel.show(null);
        }}
        title={opened ? enquirySenderName(opened.sender) : "Enquiry"}
        status={
          opened ? (
            <MappedStatusBadge status={opened.status} present={presentEnquiryStatus} />
          ) : null
        }
        meta={
          opened
            ? [
                { label: "About", value: aboutLabel(opened) },
                { label: "Assigned to", value: assigneeLabel(opened) },
              ]
            : []
        }
        summary={
          opened
            ? knownFacts([
                { label: "Message", value: opened.excerpt },
                ...(opened.sender.email
                  ? [{ label: "Email", value: opened.sender.email, copyValue: opened.sender.email }]
                  : []),
                {
                  label: "Account",
                  value: opened.sender.type === "member" ? "LAX Account member" : "Guest",
                },
                {
                  label: "Received",
                  value: formatStaffDateTime(opened.createdAt, { zoneLabel: true }),
                },
                { label: "Enquiry ID", value: opened.id, copyValue: opened.id },
              ])
            : []
        }
        overflow={
          opened && canWrite ? (
            <OverflowMenu
              label={`More actions for the enquiry from ${enquirySenderName(opened.sender)}`}
              actions={actions.actionsFor(toTarget(opened))}
            />
          ) : null
        }
        footer={
          opened ? (
            <StaffButton asChild variant="primary" icon={<MessageSquareText aria-hidden />}>
              <Link href={enquiryPath(opened)}>Open conversation</Link>
            </StaffButton>
          ) : null
        }
      >
        {null}
      </DetailPanel>

      {actions.dialogs}
      <StaffDialog
        open={actions.conflict}
        onOpenChange={(open) => {
          if (!open) actions.dismissConflict();
        }}
        title="This enquiry changed"
        description="Someone else updated it while you had it open. Reload to see their change, then try again."
        footer={
          <StaffButton variant="primary" onClick={actions.reload}>
            Reload
          </StaffButton>
        }
      />
    </>
  );
}
