import type { UserNotification } from "@auction/types";
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

let searchParams = new URLSearchParams();

vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace: vi.fn() }),
  usePathname: () => "/dashboard/notifications",
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
    read: true,
    createdAt: new Date("2026-05-01T10:00:00.000Z"),
  },
];

let inboxState = { ...emptyInbox, items: bandedItems };

vi.mock("@/components/dashboard/notifications/use-notifications-inbox", () => ({
  useNotificationsInbox: () => inboxState,
}));

vi.mock("@/components/dashboard/notifications/notifications-type-filter-toolbar", () => ({
  NotificationsTypeFilterToolbar: () => null,
}));

vi.mock("@/components/dashboard/section-tabs-nav", () => ({
  SectionTabsNav: () => null,
}));

import { NotificationsInboxBoard } from "@/components/dashboard/notifications-inbox-board";

describe("NotificationsInboxBoard", () => {
  it("uses FilterEmptyState when type filter yields zero rows", () => {
    searchParams = new URLSearchParams("type=outbid");
    inboxState = { ...emptyInbox, items: [] };
    render(<NotificationsInboxBoard pageMeta="Buying" />);

    expect(screen.getByText(/No notifications match this filter/i)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Clear filters/i })).toHaveAttribute(
      "href",
      "/dashboard/notifications",
    );
  });

  it("renders date band headers outside notification row list items", () => {
    searchParams = new URLSearchParams();
    inboxState = { ...emptyInbox, items: bandedItems };
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-05-28T15:00:00.000Z"));

    const { container } = render(<NotificationsInboxBoard pageMeta="Buying" />);

    const todayHeading = screen.getByRole("heading", { name: "Today" });
    const earlierHeading = screen.getByRole("heading", { name: "Earlier" });

    const todaySection = todayHeading.closest("section");
    const todayCard = todaySection?.querySelector(":scope > div.overflow-hidden");
    const todayList = todayCard?.querySelector("ul");

    expect(todayCard).toBeTruthy();
    expect(todayHeading.compareDocumentPosition(todayCard as Element)).toBe(
      Node.DOCUMENT_POSITION_FOLLOWING,
    );
    expect(todayList?.contains(todayHeading)).toBe(false);
    expect(todayList?.textContent).toContain("Today notice");

    const earlierSection = earlierHeading.closest("section");
    const earlierCard = earlierSection?.querySelector(":scope > div.overflow-hidden");
    expect(earlierCard).toBeTruthy();
    expect(earlierHeading.compareDocumentPosition(earlierCard as Element)).toBe(
      Node.DOCUMENT_POSITION_FOLLOWING,
    );
    expect(earlierCard?.querySelector("ul")?.contains(earlierHeading)).toBe(false);

    const groups = container.querySelector('[aria-label="Notification groups"]');
    expect(groups?.querySelectorAll("section")).toHaveLength(2);

    vi.useRealTimers();
  });
});
