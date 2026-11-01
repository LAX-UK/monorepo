"use client";

import { AssignMenu } from "@/components/admin/consignment-inbox/assign-menu";
import { useInboxListHotkeys } from "@/components/admin/consignment-inbox/use-inbox-hotkeys";
import { useStaffListNavigation } from "@/components/admin/staff/use-staff-list-navigation";
import {
  assignConsignmentThreadAction,
  bulkConsignmentThreadsAction,
  closeConsignmentThreadAction,
  markConsignmentThreadUnreadAction,
} from "@/lib/actions/consignment-inbox";
import { inboxEmptyState } from "@/lib/admin/consignment-inbox/inbox-empty-states";
import {
  INBOX_FILTER_LABELS,
  INBOX_SORT_OPTIONS,
  type InboxFilterKey,
  type InboxListState,
  SAVED_REPLIES_PATH,
  inboxClearedHref,
  inboxFilterChips,
  inboxFiltered,
  inboxHref,
  inboxRangeSummary,
  inboxSort,
  inboxThreadHref,
  inboxViews,
} from "@/lib/admin/consignment-inbox/inbox-list-state";
import {
  coverNote,
  lastMessageLine,
  waitingCue,
  workingDuration,
} from "@/lib/admin/consignment-inbox/inbox-presenters";
import { notify } from "@/lib/ui/notify";
import {
  type DataColumn,
  DataViews,
  FilterMenu,
  ListPage,
  PersonCell,
  PrimaryCell,
  SortMenu,
  StackedCell,
  StaffAvatar,
  StaffButton,
  StaffButtonLink,
  StaffDate,
  type StaffLinkComponent,
  StatusBadge,
  TableSearch,
} from "@auction/staff-ui";
import type {
  ConsignmentInboxListResponse,
  ConsignmentInboxRow,
  ConsignmentInboxSummary,
} from "@auction/validators";
import { Archive, MessageSquareText, Paperclip, UserPlus } from "lucide-react";
import NextLinkBase from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";

const NextLink: StaffLinkComponent = NextLinkBase;

type Props = {
  state: InboxListState;
  list: ConsignmentInboxListResponse | null;
  summary: ConsignmentInboxSummary | null;
  loadError: string | null;
  viewer: { userId: string; canReply: boolean; canManageSavedReplies: boolean };
};

function LastMessage({ row }: { row: ConsignmentInboxRow }) {
  const line = lastMessageLine(row.lastMessage);
  return (
    <span className="flex min-w-0 items-center gap-1.5">
      <span className="shrink-0 font-medium text-staff-fg">{line.who}</span>
      {row.lastMessage.hasAttachment ? (
        <Paperclip
          aria-label="With a file"
          className="size-3.5 shrink-0 text-staff-muted"
          strokeWidth={1.75}
        />
      ) : null}
      <span className="truncate text-staff-muted">{line.text}</span>
    </span>
  );
}

function Waiting({ row, now }: { row: ConsignmentInboxRow; now: Date }) {
  if (!row.clock) {
    return (
      <StackedCell secondary={row.status === "closed" ? "Closed" : "Answered"}>
        <StaffDate value={row.lastMessage.at} />
      </StackedCell>
    );
  }
  const cue = waitingCue(row.clock, now);
  return (
    <span className="flex flex-col items-start gap-0.5">
      <span className="font-medium text-staff-fg tabular-nums">
        {workingDuration(row.clock.waitedMinutes)}
      </span>
      {cue.kind === "badge" ? (
        <StatusBadge tone={cue.tone}>{cue.label}</StatusBadge>
      ) : (
        <span className="text-staff-xs text-staff-muted">{cue.label}</span>
      )}
    </span>
  );
}

/**
 * The inbox: client messages about consignments, the unanswered ones first by working hours
 * waited. Four views, search, three filters with counts and a visible sort, all in the URL; each
 * row opens its thread page, carrying the list so J and K work through it there.
 */
export function InboxStaffList({ state, list, summary, loadError, viewer }: Props) {
  const router = useRouter();
  const { pending, navigate, Link: ListLink } = useStaffListNavigation();
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [assignFor, setAssignFor] = useState<string | null>(null);
  const [bulkAssignOpen, setBulkAssignOpen] = useState(false);
  const [now] = useState(() => new Date());
  useInboxListHotkeys();

  const rows = list?.data ?? [];
  const facets = list?.facets ?? { specialist: [], sale: [], organisation: [] };
  const sort = list?.sort ?? inboxSort(state);
  const waitingView = state.view === "unanswered" || state.view === "mine";

  const columns = useMemo<DataColumn<ConsignmentInboxRow>[]>(
    () => [
      {
        id: "consignment",
        header: "Consignment",
        mobile: "title",
        cell: (row) => (
          <PrimaryCell
            href={inboxThreadHref(row.submissionId, state)}
            Link={NextLink}
            unread={row.unread}
            thumbnail={{ src: row.imageUrl, missingLabel: "No photos yet" }}
            secondary={`${row.reference} · ${row.sale?.name ?? "Not in a sale"}`}
          >
            {row.title}
          </PrimaryCell>
        ),
      },
      {
        id: "client",
        header: "Client",
        width: "17%",
        hideBelow: "md",
        mobile: "meta",
        cell: (row) => (
          <StackedCell secondary={row.clientPerson?.name ?? null}>
            {row.account?.kind === "organisation" ? row.account.name : "Private seller"}
          </StackedCell>
        ),
      },
      {
        id: "last-message",
        header: "Last message",
        width: "24%",
        hideBelow: "lg",
        mobile: "meta",
        cell: (row) => <LastMessage row={row} />,
      },
      {
        id: "waiting",
        header: waitingView ? "Waiting" : "Last activity",
        width: "148px",
        mobile: "meta",
        truncate: false,
        cell: (row) => <Waiting row={row} now={now} />,
      },
      {
        id: "assignee",
        header: "Assignee",
        width: "17%",
        hideBelow: "lg",
        mobile: "meta",
        cell: (row) =>
          row.assignee ? (
            <PersonCell
              name={row.assignee.name}
              secondary={row.assignee.covering ? coverNote(row.assignee) : null}
            />
          ) : (
            <span className="flex items-center gap-2.5 text-staff-muted">
              <StaffAvatar empty />
              Unassigned
            </span>
          ),
      },
    ],
    [state, waitingView, now],
  );

  const refresh = () => router.refresh();
  const filterMenu = (key: InboxFilterKey) => (
    <FilterMenu
      key={key}
      label={INBOX_FILTER_LABELS[key]}
      options={facets[key].map((facet) => ({
        value: facet.id,
        label: facet.label,
        count: facet.count,
      }))}
      selected={state[key]}
      onChange={(values) => navigate(inboxHref(state, { [key]: values }))}
    />
  );

  const bulk = async (action: "mark_read" | "close" | "assign", assignee?: string | null) => {
    const result = await bulkConsignmentThreadsAction({
      action,
      submissionIds: [...selected],
      ...(action === "assign" ? { assignedToUserId: assignee ?? null } : {}),
    });
    if (!result.ok) {
      notify.error("Nothing was changed", { description: result.error });
      return;
    }
    const changed = result.data?.changed ?? selected.size;
    const noun = changed === 1 ? "thread" : "threads";
    notify.success(
      action === "close"
        ? `${changed} ${noun} closed`
        : action === "mark_read"
          ? `${changed} ${noun} marked as read`
          : `${changed} ${noun} assigned`,
    );
    setSelected(new Set());
    refresh();
  };

  const rowAssignee = rows.find((row) => row.submissionId === assignFor) ?? null;
  const empty = inboxEmptyState(state.view, summary);

  return (
    <>
      <ListPage<ConsignmentInboxRow>
        title="Inbox"
        description="Client messages about consignments. Unanswered threads sort by working hours waited."
        Link={ListLink}
        listKey="bid-admin.inbox"
        access={viewer.canReply ? "full" : "read-only"}
        secondaryActions={
          <StaffButtonLink
            href={SAVED_REPLIES_PATH}
            Link={NextLink}
            icon={<MessageSquareText aria-hidden />}
          >
            Saved replies
          </StaffButtonLink>
        }
        views={
          <DataViews views={inboxViews(state, summary)} activeId={state.view} Link={ListLink} />
        }
        search={
          <TableSearch
            key={state.q}
            fullWidth
            label="Search the inbox"
            placeholder="Search reference, work or client"
            value={state.q}
            onSearch={(q) => navigate(inboxHref(state, { q }))}
          />
        }
        filters={
          <>
            {filterMenu("specialist")}
            {filterMenu("sale")}
            {filterMenu("organisation")}
            <SortMenu
              value={sort}
              options={INBOX_SORT_OPTIONS}
              onChange={(next) => navigate(inboxHref(state, { sort: next }))}
            />
          </>
        }
        activeFilters={inboxFilterChips(state, facets).map((chip) => ({
          id: chip.id,
          label: chip.label,
          onRemove: () => navigate(chip.href),
        }))}
        onClearFilters={() => navigate(inboxClearedHref(state))}
        loading={pending}
        filtered={inboxFiltered(state)}
        error={
          loadError
            ? { title: "The inbox didn’t load", description: loadError, onRetry: refresh }
            : null
        }
        empty={{
          title: empty.title,
          description: empty.description,
          ...(empty.action
            ? {
                action: (
                  <StaffButtonLink href={empty.action.href} Link={ListLink} size="sm">
                    {empty.action.label}
                  </StaffButtonLink>
                ),
              }
            : {}),
        }}
        noResults={{ noun: "threads" }}
        table={{
          label: "Client message threads",
          columns,
          data: rows,
          getRowId: (row) => row.submissionId,
          defaultDensity: "comfortable",
          onRowOpen: (row) => router.push(inboxThreadHref(row.submissionId, state)),
          ...(viewer.canReply
            ? {
                selectedIds: selected,
                onSelectedIdsChange: setSelected,
                bulkNoun: { one: "thread", other: "threads" },
                bulkActions: () => (
                  <>
                    <AssignMenu
                      trigger={
                        <StaffButton size="sm" icon={<UserPlus aria-hidden />}>
                          Assign…
                        </StaffButton>
                      }
                      open={bulkAssignOpen}
                      onOpenChange={setBulkAssignOpen}
                      mode="assign"
                      align="start"
                      viewerUserId={viewer.userId}
                      assigneeUserId={null}
                      specialist={null}
                      onChoose={(person) => void bulk("assign", person?.userId ?? null)}
                    />
                    <StaffButton size="sm" onClick={() => void bulk("mark_read")}>
                      Mark as read
                    </StaffButton>
                    <StaffButton
                      size="sm"
                      icon={<Archive aria-hidden />}
                      onClick={() => void bulk("close")}
                    >
                      Close
                    </StaffButton>
                  </>
                ),
              }
            : {}),
          rowActions: {
            label: (row) => `Actions for ${row.title}`,
            actions: (row) => [
              {
                id: "consignment",
                label: "Open consignment",
                href: `/admin/submissions/${row.submissionId}`,
              },
              ...(viewer.canReply
                ? [
                    {
                      id: "assign",
                      label: "Assign…",
                      onSelect: () => setAssignFor(row.submissionId),
                    },
                    {
                      id: "unread",
                      label: "Mark as unread",
                      onSelect: () =>
                        void markConsignmentThreadUnreadAction(row.submissionId).then((result) => {
                          if (result.ok) refresh();
                          else notify.error("Not marked unread", { description: result.error });
                        }),
                    },
                  ]
                : []),
              {
                id: "copy",
                label: "Copy reference",
                onSelect: () =>
                  void navigator.clipboard
                    ?.writeText(row.reference)
                    .then(() => notify.success(`${row.reference} copied`)),
              },
              ...(viewer.canReply && row.status !== "closed"
                ? [
                    {
                      id: "close",
                      label: "Close thread",
                      onSelect: () =>
                        void closeConsignmentThreadAction(row.submissionId).then((result) => {
                          if (result.ok) {
                            notify.success("Thread closed", {
                              description: "It reopens if the client writes again.",
                            });
                            refresh();
                          } else notify.error("Not closed", { description: result.error });
                        }),
                    },
                  ]
                : []),
            ],
          },
        }}
        pagination={
          list && rows.length > 0
            ? {
                summary: inboxRangeSummary(state.offset, rows.length, list.total),
                prevHref:
                  state.offset > 0
                    ? inboxHref(state, { offset: Math.max(0, state.offset - state.limit) })
                    : null,
                nextHref:
                  state.offset + rows.length < list.total
                    ? inboxHref(state, { offset: state.offset + state.limit })
                    : null,
              }
            : null
        }
      />
      {rowAssignee ? (
        <AssignMenu
          trigger={<span className="sr-only">Assign {rowAssignee.title}</span>}
          open
          onOpenChange={(open) => {
            if (!open) setAssignFor(null);
          }}
          mode="assign"
          viewerUserId={viewer.userId}
          assigneeUserId={rowAssignee.assignee?.userId ?? null}
          specialist={null}
          onChoose={(person) =>
            void assignConsignmentThreadAction(rowAssignee.submissionId, {
              assignedToUserId: person?.userId ?? null,
              covering: false,
            }).then((result) => {
              setAssignFor(null);
              if (result.ok) {
                notify.success(person ? `Assigned to ${person.name}` : "Unassigned");
                refresh();
              } else notify.error("Not assigned", { description: result.error });
            })
          }
        />
      ) : null}
    </>
  );
}
