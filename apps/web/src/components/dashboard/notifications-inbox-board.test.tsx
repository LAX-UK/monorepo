import type { UserNotification } from "@auction/types";
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

let searchParams = new URLSearchParams();

vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace: vi.fn() }),
  usePathname: () => "/notifications",
  useSearchParams: () => searchParams,
}));

const emptyInbox = {
  items: [] as UserNotification[],
  loading: false,
  loadingMore: false,
  hasMore: false,
  error: null,
  loadMore: vi.fn(),
  retry: vi.fn(),
  markRead: vi.fn(),
  markReadMany: vi.fn(),
  markAllRead: vi.fn(),
  archive: vi.fn(),
  archiveMany: vi.fn(),
};

const bandedItems: UserNotification[] = [
  {
    id: "n-today",
    userId: "u1",
    type: "outbid",
    title: "Today notice",
    message: "Today body",
    lotId: null,
    submissionId: null,
    read: false,
    createdAt: new Date("2026-05-28T10:00:00.000Z"),
  },
  {
    id: "n-old",
    userId: "u1",
    type: "lot_won",
    title: "Earlier notice",
    message: "Earlier body",
    lotId: null,
    submissionId: null,
    read: true,
    createdAt: new Date("2026-05-01T10:00:00.000Z"),
  },
];

let inboxState = { ...emptyInbox, items: bandedItems };

vi.mock("@/components/dashboard/notifications/use-notifications-inbox", () => ({
  useNotificationsInbox: () => inboxState,
}));

vi.mock("@/components/layout/client-layout-context", () => ({
  useClientLayout: () => "website",
}));

import { NotificationsInboxBoard } from "@/components/dashboard/notifications-inbox-board";

describe("NotificationsInboxBoard", () => {
  it("uses FilterEmptyState when type filter yields zero rows", () => {
    searchParams = new URLSearchParams("type=outbid");
    inboxState = { ...emptyInbox, items: [] };
    render(<NotificationsInboxBoard />);

    expect(screen.getByText(/No notifications match this filter/i)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Clear filters/i })).toHaveAttribute(
      "href",
      "/notifications",
    );
  });

  it("groups by day, unread first, with the day heading outside each list", () => {
    searchParams = new URLSearchParams();
    inboxState = { ...emptyInbox, items: bandedItems };
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-05-28T15:00:00.000Z"));

    render(<NotificationsInboxBoard />);

    const today = screen.getByRole("heading", { name: "Today" }).closest("section");
    const list = today?.querySelector("ul");
    expect(list?.textContent).toContain("Today notice");
    expect(list?.contains(screen.getByRole("heading", { name: "Today" }))).toBe(false);
    expect(screen.getByRole("heading", { name: "Earlier" })).toBeInTheDocument();
    expect(screen.getByText("Unread:", { exact: false })).toBeInTheDocument();

    vi.useRealTimers();
  });

  it("offers All and Unread, the unread count and a way to mark everything read", () => {
    searchParams = new URLSearchParams();
    inboxState = { ...emptyInbox, items: bandedItems };
    render(<NotificationsInboxBoard />);

    const views = screen.getByRole("navigation", { name: "Notifications" });
    expect(views.querySelectorAll("a")).toHaveLength(2);
    expect(screen.getByRole("link", { name: /^All/ })).toHaveAttribute("aria-current", "page");
    expect(screen.getByRole("link", { name: /^Unread\W+1$/ })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Mark all as read" })).toBeEnabled();
    expect(screen.getByRole("button", { name: "Mark as read: Today notice" })).toBeInTheDocument();
  });

  it("says calmly when the inbox could not load", () => {
    searchParams = new URLSearchParams();
    inboxState = { ...emptyInbox, items: [] };
    render(<NotificationsInboxBoard loadFailure />);
    expect(
      screen.getByRole("heading", { name: "We couldn't load your notifications" }),
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Try again" })).toBeInTheDocument();
  });
});
