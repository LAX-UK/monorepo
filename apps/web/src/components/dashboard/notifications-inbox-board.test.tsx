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

import { type NeedsActionView, needsActionRows } from "@/lib/notifications/needs-action";
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
    accountsHref: "/organisations",
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
  needsAction: NeedsActionView | null = null,
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
        needsAction={needsAction}
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

  describe("with an organisation's Needs-you reader", () => {
    const account = { kind: "organisation" as const, name: "Northbank Gallery", initials: "NG" };
    const reader = (failed = false): NeedsActionView => ({
      account,
      ...needsActionRows(
        failed
          ? null
          : {
              kinds: ["outbid", "pay"],
              tasks: [
                {
                  kind: "outbid",
                  lots: [
                    {
                      id: "l1",
                      title: "Abstract in Cobalt",
                      endsAt: new Date("2026-11-04T12:00:00Z"),
                    },
                  ],
                  raisedAt: null,
                  link: { page: "lot", id: "l1" },
                },
                {
                  kind: "pay",
                  purchases: [{ id: "p1", title: "Estuary at Dusk" }],
                  raisedAt: null,
                  link: { page: "purchase", id: "p1" },
                },
              ],
              counts: {},
              truncated: false,
            },
        {
          organisationName: "Northbank Gallery",
          now: new Date("2026-11-02T10:00:00Z"),
          actor: { role: "owner" },
        },
      ),
    });

    it("lists the reader's tasks as rows with the account, the work's title and one action", () => {
      renderBoard(parseInboxQuery({}), reader(), { needsAction: 0, unread: 3 });
      const rows = screen.getAllByRole("listitem").filter((li) => li.dataset.testid);
      expect(rows).toHaveLength(2);
      const first = within(rows[0] as HTMLElement);
      expect(first.getByText("Outbid on “Abstract in Cobalt”")).toBeInTheDocument();
      expect(first.getByText("Northbank Gallery")).toBeInTheDocument();
      expect(first.getByRole("link", { name: "Bid again" })).toBeInTheDocument();
      expect(within(rows[1] as HTMLElement).getByRole("link", { name: "Pay" })).toHaveAttribute(
        "href",
        "/purchases/pay?lots=p1",
      );
    });

    it("counts the tab by the reader's tasks, not by notifications", () => {
      renderBoard(parseInboxQuery({}), reader(), { needsAction: 0, unread: 3 });
      const first = screen
        .getAllByRole("link")
        .find((a) => a.getAttribute("href")?.startsWith("/notifications"));
      expect(first?.textContent).toBe("Needs action2");
    });

    it("narrows the tasks by search", () => {
      renderBoard(parseInboxQuery({ q: "estuary" }), reader());
      expect(screen.getAllByRole("listitem").filter((li) => li.dataset.testid)).toHaveLength(1);
      expect(screen.queryByText("Outbid on “Abstract in Cobalt”")).toBeNull();
    });

    it("says nothing needs you when the reader answers with no tasks", () => {
      renderBoard(parseInboxQuery({}), { account, rows: [], failed: false });
      expect(screen.getByText("Nothing needs you")).toBeInTheDocument();
    });

    it("says the list could not load when the reader did not answer", () => {
      renderBoard(parseInboxQuery({}), reader(true));
      expect(screen.getByText("We couldn't load this list.")).toBeInTheDocument();
      expect(screen.queryByText("Nothing needs you")).toBeNull();
    });

    it("leaves the other views to the notifications", () => {
      inbox.items = [notice("a", { id: NORTH, name: "Northbank Gallery" })];
      renderBoard(parseInboxQuery({ tab: "all" }), reader());
      expect(screen.getByRole("link", { name: /Notice a/ })).toBeInTheDocument();
      expect(screen.queryByText("Outbid on “Abstract in Cobalt”")).toBeNull();
    });
  });

  describe("with a person's own money-driven Needs action", () => {
    const account = { kind: "personal" as const, name: "Ada Lovelace", initials: "AL" };
    const rows: NeedsActionView["rows"] = [
      {
        key: "pay:lot-1",
        topic: "purchase",
        title: "Pay £8,000.00 for “Estuary at Dusk”",
        detail: "Pay by 12 November",
        due: { text: "Due 12 Nov 2026", tone: "warning", dateTime: "2026-11-12T00:00:00.000Z" },
        raised: null,
        action: { label: "Pay", href: "/purchases/pay?lots=lot-1" },
        section: "purchases",
        items: 1,
      },
      {
        key: "waiting:lot-2",
        topic: "purchase",
        title: "Payment for “Harbour”",
        detail: "£500.00 · being confirmed",
        due: null,
        raised: null,
        action: { label: "View", href: "/purchases/lot-2" },
        section: "purchases",
        items: 1,
      },
      {
        key: "identity",
        topic: "account",
        title: "Verify your identity",
        detail: "We need to check who you are before you can bid.",
        due: null,
        raised: null,
        action: { label: "Verify", href: "/verify-identity" },
        section: null,
        items: 1,
      },
    ];

    it("lists the amounts to pay with their due dates and the payments waiting, for the person", () => {
      renderBoard(
        parseInboxQuery({}),
        { account, rows, failed: false },
        { needsAction: 0, unread: 3 },
      );
      const listed = screen.getAllByRole("listitem").filter((li) => li.dataset.testid);
      // Money first, then the other tasks the person has: nothing is dropped.
      expect(listed).toHaveLength(3);
      expect(
        within(listed[2] as HTMLElement).getByText("Verify your identity"),
      ).toBeInTheDocument();
      const first = within(listed[0] as HTMLElement);
      expect(first.getByText("Pay £8,000.00 for “Estuary at Dusk”")).toBeInTheDocument();
      // The date shows once on a phone and once beside the button on wider screens.
      expect(first.getAllByText("Due 12 Nov 2026").length).toBeGreaterThan(0);
      expect(first.getByText("Ada Lovelace")).toBeInTheDocument();
      expect(first.getByRole("link", { name: "Pay" })).toHaveAttribute(
        "href",
        "/purchases/pay?lots=lot-1",
      );
      expect(
        within(listed[1] as HTMLElement).getByRole("link", { name: "View" }),
      ).toBeInTheDocument();
    });

    it("counts the tab by the rows it lists, whatever the notification counts say", () => {
      renderBoard(
        parseInboxQuery({}),
        { account, rows, failed: false },
        { needsAction: 0, unread: 3 },
      );
      const first = screen
        .getAllByRole("link")
        .find((a) => a.getAttribute("href")?.startsWith("/notifications"));
      expect(first?.textContent).toBe("Needs action3");
    });

    it("says nothing needs you when nothing is owed, waiting or on hold", () => {
      renderBoard(parseInboxQuery({}), { account, rows: [], failed: false });
      expect(screen.getByText("Nothing needs you")).toBeInTheDocument();
    });

    it("says the list could not load when the money could not be read", () => {
      renderBoard(parseInboxQuery({}), { account, rows: [], failed: true });
      expect(screen.getByText("We couldn't load this list.")).toBeInTheDocument();
      expect(screen.queryByText("Nothing needs you")).toBeNull();
    });
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
