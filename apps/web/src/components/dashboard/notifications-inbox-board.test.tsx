import { AccountChromeProvider } from "@/components/layout/account-switcher/account-chrome-context";
import type { AccountChrome } from "@/lib/navigation/account-switcher-model";
import { parseInboxQuery } from "@/lib/notifications/inbox-query";
import type { UserNotificationListItem } from "@auction/types";
import { fireEvent, render, screen, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), refresh: vi.fn() }),
  usePathname: () => "/notifications",
  useSearchParams: () => new URLSearchParams(),
}));

const NORTH = "aaaaaaaa-0000-4000-8000-000000000001";
const CEDAR = "aaaaaaaa-0000-4000-8000-000000000002";
const ME = "aaaaaaaa-0000-4000-8000-000000000009";

const setOrganisationMuted = vi.fn(async () => ({ ok: true as const }));
vi.mock("@/lib/services/client/notifications-inbox.client", () => ({
  fetchInboxCounts: vi.fn(async () => ({ needsAction: 2, unread: 3 })),
  setOrganisationMuted: (...args: unknown[]) => setOrganisationMuted(...(args as [])),
}));

const inbox = {
  items: [] as UserNotificationListItem[],
  loading: false,
  loadingMore: false,
  hasMore: false,
  error: null as string | null,
  loadMore: vi.fn(),
  retry: vi.fn(),
  markRead: vi.fn(async () => true),
  markReadMany: vi.fn(async () => ({ fulfilled: 1, rejected: 0 })),
  markAllRead: vi.fn(async () => true),
  archive: vi.fn(async () => true),
  archiveMany: vi.fn(async () => ({ fulfilled: 1, rejected: 0 })),
};
vi.mock("@/components/dashboard/notifications/use-notifications-inbox", () => ({
  useNotificationsInbox: () => inbox,
}));

import type { AttentionTask } from "@/lib/navigation/client-attention";
import { NotificationsInboxBoard } from "./notifications-inbox-board";

const option = (id: string, kind: "personal" | "organisation", name: string, current = false) => ({
  id,
  kind,
  name,
  detail: "",
  initials: name.slice(0, 2).toUpperCase(),
  current,
  underReview: false,
});
const chrome: AccountChrome = {
  current: option(NORTH, "organisation", "Northbank Gallery", true),
  switcher: {
    options: [
      option(ME, "personal", "Personal"),
      option(NORTH, "organisation", "Northbank Gallery", true),
      option(CEDAR, "organisation", "Cedar & Stone Fine Art"),
    ],
    pendingInvitations: 0,
    invitationsHref: "/organisations/invitations",
    registerHref: "/onboarding/organisation",
  },
};

function notice(
  id: string,
  account: { id: string; name: string } | null,
  extra: Partial<UserNotificationListItem> = {},
): UserNotificationListItem {
  return {
    id,
    userId: "u1",
    type: "outbid",
    title: `Notice ${id}`,
    message: "Lot 88 closes today.",
    lotId: "l88",
    submissionId: null,
    read: false,
    createdAt: new Date(),
    account: account
      ? {
          legalEntityId: account.id,
          kind: "organisation",
          displayName: account.name,
          canSwitch: true,
        }
      : null,
    needsAction: true,
    ...extra,
  };
}

function renderBoard(
  query = parseInboxQuery({}),
  attentionTasks: AttentionTask[] = [],
  counts = { needsAction: 2, unread: 3 },
) {
  return render(
    <AccountChromeProvider account={chrome}>
      <NotificationsInboxBoard
        query={query}
        initialPage={null}
        counts={counts}
        mutedIds={[]}
        paused={null}
        attentionTasks={attentionTasks}
      />
    </AccountChromeProvider>,
  );
}

describe("NotificationsInboxBoard", () => {
  beforeEach(() => {
    inbox.items = [];
    inbox.error = null;
    inbox.loading = false;
  });

  it("puts Needs action first with its count, then All, Unread and Archived", () => {
    renderBoard();
    const tabs = screen
      .getAllByRole("link")
      .filter((a) => a.getAttribute("href")?.startsWith("/notifications"));
    expect(tabs.map((tab) => tab.textContent)).toEqual([
      "Needs action2",
      "All",
      "Unread3",
      "Archived",
    ]);
  });

  it("tags each row with its account, and opens another account's through the switch hop", () => {
    inbox.items = [
      notice("a", { id: NORTH, name: "Northbank Gallery" }),
      notice("b", { id: CEDAR, name: "Cedar & Stone Fine Art" }),
      notice("c", null),
    ];
    renderBoard();
    const rows = screen
      .getAllByRole("listitem")
      .filter((li) => li.querySelector("[data-row-link]"));
    expect(within(rows[0] as HTMLElement).getByText("Northbank Gallery")).toBeInTheDocument();
    expect(within(rows[2] as HTMLElement).getByText("Personal")).toBeInTheDocument();
    const cedar = within(rows[1] as HTMLElement).getByRole("link", { name: /Notice b/ });
    expect(cedar.getAttribute("href")).toMatch(/^\/switch-account\?to=/);
  });

  it("says nothing needs you on an empty Needs action", () => {
    renderBoard();
    expect(screen.getByText("Nothing needs you")).toBeInTheDocument();
  });

  it("lists what the header chip prompts for instead of saying nothing needs you", () => {
    renderBoard(
      parseInboxQuery({}),
      [
        {
          kind: "outbid",
          title: "Outbid on lot 2",
          actionLabel: "Review your bids",
          href: "/bids?tab=active",
        },
        {
          kind: "payment-due",
          title: "2 purchases to pay",
          actionLabel: "Go to purchases",
          href: "/purchases",
        },
      ],
      { needsAction: 0, unread: 3 },
    );
    expect(screen.queryByText("Nothing needs you")).toBeNull();
    expect(screen.getByText("Outbid on lot 2")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Go to purchases" })).toHaveAttribute(
      "href",
      "/purchases",
    );
    const needsAction = screen
      .getAllByRole("link")
      .find((a) => a.getAttribute("href")?.startsWith("/notifications"));
    expect(needsAction?.textContent).toBe("Needs action2");
  });

  it("offers to clear a search that matched nothing", () => {
    renderBoard(parseInboxQuery({ q: "Hockney" }));
    expect(screen.getByText("No results for “Hockney”")).toBeInTheDocument();
  });

  it("keeps the page when the list fails, with a way to try again", () => {
    inbox.error = "We couldn't load your notifications.";
    renderBoard();
    fireEvent.click(screen.getByRole("button", { name: "Try again" }));
    expect(inbox.retry).toHaveBeenCalled();
    expect(screen.queryByRole("button", { name: "Mark all as read" })).toBeNull();
  });

  it("picks rows to mark read or archive together", () => {
    inbox.items = [notice("a", { id: NORTH, name: "Northbank Gallery" })];
    renderBoard();
    fireEvent.click(screen.getByRole("checkbox", { name: "Select: Notice a" }));
    const bar = screen.getByRole("region", { name: "Selected notifications" });
    expect(bar).toHaveTextContent("1 notification selected");
    fireEvent.click(within(bar).getByRole("button", { name: "Archive" }));
    expect(inbox.archiveMany).toHaveBeenCalledWith(["a"]);
  });
});
