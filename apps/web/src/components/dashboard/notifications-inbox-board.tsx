"use client";

import { DashboardListPage } from "@/components/dashboard/dashboard-list-page";
import {
  ListEmpty,
  ListLoadError,
  ListNoResults,
  ListSkeleton,
} from "@/components/workspace/list-states";
import type { AttentionTask } from "@/lib/navigation/client-attention";
import {
  INBOX_TABS,
  INBOX_TAB_LABEL,
  type InboxAccount,
  type InboxQuery,
  type InboxTab,
  NOTIFICATION_TYPES,
  inboxCleared,
  inboxHref,
  inboxNarrowed,
  inboxTypeLabel,
} from "@/lib/notifications/inbox-query";
import {
  Button,
  ButtonLink,
  Field,
  FilterSheet,
  ListToolbar,
  NativeSelect,
  Notice,
  SelectionBar,
  type TabNavItem,
} from "@auction/ui/lax";
import Link from "next/link";
import { useEffect, useState } from "react";
import { NotificationRow } from "./notifications/notification-row";
import {
  type InboxBoardInput,
  type InboxCounts,
  useNotificationsInboxBoard,
} from "./notifications/use-notifications-inbox-board";

const EMPTY: Record<InboxTab, { title: string; description: string }> = {
  needs_action: {
    title: "Nothing needs you",
    description: "Outbids, invoices and agreements that need you appear here first.",
  },
  all: {
    title: "No notifications yet",
    description: "Bids, purchases and selling updates for every account you belong to appear here.",
  },
  unread: { title: "Nothing unread", description: "You're up to date. Everything is under All." },
  archived: {
    title: "Nothing archived",
    description: "Notifications you archive are kept here.",
  },
};

const ANY = "any";

function tabCount(
  tab: InboxTab,
  counts: InboxCounts | null,
  tasks: readonly AttentionTask[],
): number | null {
  // The header chip's prompts count here too, so the tab never reads 0 beside them.
  if (tab === "needs_action") return (counts?.needsAction ?? 0) || tasks.length || null;
  if (!counts) return null;
  if (tab === "unread") return counts.unread;
  return null;
}

/**
 * Notifications for every account the person belongs to: Needs action first, then All, Unread
 * and Archived, each with its own address. Rows carry their account; opening one for another
 * account switches to it with a notice. Search, a type filter and an account picker narrow the
 * list; rows are picked to mark read or archive together, and a row's menu mutes an organisation.
 */
export function NotificationsInboxBoard({
  paused,
  attentionTasks,
  ...input
}: InboxBoardInput & {
  /** The account in use is paused: notifications still arrive, and the page says so. */
  paused: string | null;
  /** What the header chip prompts for (outbid, payment due), from the same attention reader. */
  attentionTasks: readonly AttentionTask[];
}) {
  const board = useNotificationsInboxBoard(input);
  const { query, setQuery, counts } = board;
  const [filterOpen, setFilterOpen] = useState(false);
  const [draft, setDraft] = useState(query);
  useEffect(() => {
    if (filterOpen) setDraft(query);
  }, [filterOpen, query]);

  const multiAccount = board.accounts.options.length > 1;
  const accountOptions: { value: InboxAccount; label: string }[] = [
    { value: "all", label: "All accounts" },
    ...board.accounts.options.map((option) => ({
      value: (option.kind === "personal" ? "personal" : option.id) as InboxAccount,
      label: option.name,
    })),
  ];
  const tabs: TabNavItem[] = INBOX_TABS.map((id) => {
    const count = tabCount(id, counts, attentionTasks);
    return {
      id,
      label: INBOX_TAB_LABEL[id],
      href: inboxHref({ ...query, tab: id }),
      // A lone 0 says nothing; only a number worth acting on is shown.
      ...(count ? { count } : {}),
    };
  });
  const accountLabel = accountOptions.find((o) => o.value === query.account)?.label;
  const chips = [
    ...(query.type ? [{ id: "type", label: inboxTypeLabel(query.type) ?? query.type }] : []),
    ...(query.account !== "all" && accountLabel ? [{ id: "account", label: accountLabel }] : []),
  ];
  const narrowed = inboxNarrowed(query);
  const clearAll = () => setQuery(inboxCleared(query));
  const unread = counts?.unread ?? board.rows.filter((row) => row.unread).length;

  return (
    <DashboardListPage
      title="Notifications"
      description="For every account you belong to. Opening one switches to its account."
      actions={
        board.error || unread === 0 ? undefined : (
          <Button onClick={() => void board.markAllRead()}>Mark all as read</Button>
        )
      }
    >
      <output className="sr-only" aria-live="polite" aria-atomic="true">
        {board.liveMessage}
      </output>
      <div className="flex flex-col gap-4">
        {paused ? (
          <Notice tone="info" title="Notifications still arrive while an account is paused.">
            {paused} is paused, so some actions wait. You can still open every notification.
          </Notice>
        ) : null}
        <ListToolbar
          tabs={{
            items: tabs,
            activeId: query.tab,
            label: "Notifications",
            Link,
            overflow: "scroll",
          }}
          search={{
            value: board.search,
            onValueChange: board.setSearch,
            placeholder: "Search notifications",
          }}
          filter={{ count: chips.length, open: filterOpen, onOpenChange: setFilterOpen }}
          {...(multiAccount
            ? {
                sort: (
                  <NativeSelect<InboxAccount>
                    aria-label="Account"
                    className="w-[200px] max-md:hidden"
                    value={query.account}
                    onValueChange={(account) => setQuery({ ...query, account })}
                    options={accountOptions}
                  />
                ),
              }
            : {})}
          chips={{
            filters: chips,
            onRemove: (id) =>
              setQuery(id === "type" ? { ...query, type: "" } : { ...query, account: "all" }),
            onClearAll: clearAll,
          }}
        />
        <SelectionBar
          count={board.selected.size}
          noun={["notification", "notifications"]}
          onClear={board.clearSelection}
        >
          <Button onClick={() => void board.bulkMarkRead()}>Mark as read</Button>
          {query.tab === "archived" ? null : (
            <Button variant="primary" onClick={() => void board.bulkArchive()}>
              Archive
            </Button>
          )}
        </SelectionBar>
        <InboxList
          board={board}
          query={query}
          narrowed={narrowed}
          onClear={clearAll}
          attentionTasks={attentionTasks}
        />
      </div>
      <FilterSheet
        open={filterOpen}
        onOpenChange={setFilterOpen}
        onApply={() => setQuery(draft)}
        onClear={() => setDraft({ ...draft, type: "", account: "all" })}
      >
        <Field label="Type">
          <NativeSelect
            value={draft.type || ANY}
            onValueChange={(value) => setDraft({ ...draft, type: value === ANY ? "" : value })}
            options={[
              { value: ANY, label: "Every type" },
              ...NOTIFICATION_TYPES.map((t) => ({ value: t.id, label: t.label })),
            ]}
          />
        </Field>
        {multiAccount ? (
          <Field label="Account">
            <NativeSelect<InboxAccount>
              value={draft.account}
              onValueChange={(account) => setDraft({ ...draft, account })}
              options={accountOptions}
            />
          </Field>
        ) : null}
      </FilterSheet>
    </DashboardListPage>
  );
}

/** What needs the person when no notification asks for it yet: the chip's prompts, as tasks. */
function AttentionTaskList({ tasks }: { tasks: readonly AttentionTask[] }) {
  return (
    <ul className="flex flex-col gap-2" aria-label="Needs action">
      {tasks.map((task) => (
        <li key={task.kind}>
          <Notice
            tone={task.kind === "outbid" ? "danger" : "info"}
            title={task.title}
            actions={
              <ButtonLink href={task.href} Link={Link}>
                {task.actionLabel}
              </ButtonLink>
            }
          />
        </li>
      ))}
    </ul>
  );
}

function InboxList({
  board,
  query,
  narrowed,
  onClear,
  attentionTasks,
}: {
  board: ReturnType<typeof useNotificationsInboxBoard>;
  query: InboxQuery;
  narrowed: boolean;
  onClear: () => void;
  attentionTasks: readonly AttentionTask[];
}) {
  if (board.error) return <ListLoadError onRetry={() => void board.retry()} />;
  if (board.loading) return <ListSkeleton label="Loading your notifications" rows={4} />;
  if (board.rows.length === 0) {
    if (!narrowed && query.tab === "needs_action" && attentionTasks.length > 0) {
      return <AttentionTaskList tasks={attentionTasks} />;
    }
    return narrowed ? (
      <ListNoResults query={query.q} onClear={onClear} />
    ) : (
      <ListEmpty illustration="plinth" {...EMPTY[query.tab]} />
    );
  }
  const actions = {
    onOpened: board.opened,
    onNavigate: board.navigate,
    onMarkRead: board.markRead,
    onArchive: (row: Parameters<typeof board.archive>[0]) => void board.archive(row),
    onMute: (row: Parameters<typeof board.archive>[0], muted: boolean) =>
      void board.setMute(row, muted),
  };
  return (
    <div className="flex flex-col">
      {board.groups.map((group, index) => (
        <section key={group.band} aria-labelledby={`band-${group.band}`}>
          <h2
            id={`band-${group.band}`}
            className={`${index === 0 ? "pt-0" : "pt-4"} pb-2 text-lax-12 font-medium text-lax-muted`}
          >
            {group.band}
          </h2>
          <ul className="divide-y divide-lax-line-subtle overflow-hidden rounded-lax-card border border-lax-line bg-lax-surface">
            {group.rows.map((row) => (
              <NotificationRow
                key={row.id}
                row={row}
                archived={query.tab === "archived"}
                selection={{
                  selected: board.selected.has(row.id),
                  onSelectedChange: (on) => board.toggleSelect(row.id, on),
                }}
                actions={actions}
              />
            ))}
          </ul>
        </section>
      ))}
      {board.hasMore ? (
        <div className="flex justify-center pt-6">
          <Button loading={board.loadingMore} onClick={() => void board.loadMore()}>
            Show older notifications
          </Button>
        </div>
      ) : null}
    </div>
  );
}
