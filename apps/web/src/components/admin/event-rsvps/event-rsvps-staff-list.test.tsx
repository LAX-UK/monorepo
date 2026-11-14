import type { EventRsvpStaffRow } from "@/lib/admin/events/event-rsvps-staff-list.vm";
import { expectRowOpensPage, resetRowLinks, rowOf } from "@/test/row-link";
import { StaffTooltipProvider } from "@auction/staff-ui";
import { render, screen, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { EventRsvpsStaffList, type EventRsvpsStaffListProps } from "./event-rsvps-staff-list";

vi.mock("next/link", async () => (await import("@/test/row-link")).nextLinkMock());
vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: vi.fn(), push: vi.fn(), replace: vi.fn() }),
  usePathname: () => "/admin/event-rsvps",
  useSearchParams: () => new URLSearchParams(),
}));

function event(slug: string, title: string, rsvpCount: number): EventRsvpStaffRow {
  return {
    slug,
    title,
    status: { label: "Published", tone: "success" },
    startsAt: null,
    rsvpCloseAt: null,
    rsvpCount,
    saleId: null,
    href: `/admin/event-rsvps/${slug}`,
    checkInHref: `/admin/event-rsvps/${slug}/check-in`,
    editHref: `/admin/event-rsvps/${slug}/edit`,
    saleCheckInHref: null,
  } as EventRsvpStaffRow;
}

function renderList(patch: Partial<EventRsvpsStaffListProps> = {}) {
  const props: EventRsvpsStaffListProps = {
    rows: [event("autumn-gala", "Autumn gala", 42), event("book-launch", "Book launch", 7)],
    search: { status: "published", sort: "title_asc", offset: "25" },
    counts: { all: 2, published: 2 },
    metrics: [],
    sort: { columnId: "event", direction: "asc" },
    pageSize: 25,
    pagination: null,
    loadError: null,
    filtered: false,
    ...patch,
  };
  return render(
    <StaffTooltipProvider>
      <EventRsvpsStaffList {...props} />
    </StaffTooltipProvider>,
  );
}

const IN_LIST = "?list=status%3Dpublished%26sort%3Dtitle_asc%26offset%3D25";

describe("EventRsvpsStaffList", () => {
  beforeEach(resetRowLinks);

  it("opens an event's guest list from its row, keeping the list for Previous, Next and Back", () => {
    renderList();
    expectRowOpensPage({
      title: /Autumn gala/,
      href: `/admin/event-rsvps/autumn-gala${IN_LIST}`,
      background: "42",
    });
  });

  it("has no quick-view panel any more", () => {
    renderList({ search: { event: "autumn-gala" } });
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    // An old `?event=` is not part of the list a record remembers.
    expect(
      within(rowOf(/Book launch/))
        .getAllByRole("link", { name: /Book launch/ })[0]
        ?.getAttribute("href"),
    ).toBe("/admin/event-rsvps/book-launch");
  });
});
