import type { OnsiteEventAdminDetail, OnsiteEventRsvpAdminRow } from "@auction/types";
import { render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { OnsiteEventDetail, OnsiteEventUnavailable } from "./onsite-event-detail";

vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn(), push: vi.fn() }) }));
vi.mock("@/lib/data/http/onsite-event-check-in.client", () => ({
  resendOnsiteEventPass: vi.fn(),
}));
vi.mock("@/lib/auth/step-up/use-step-up-coordinator", () => ({
  redirectToHostedReauth: vi.fn(),
}));

const event: OnsiteEventAdminDetail = {
  slug: "lax001",
  title: "Opening evening",
  status: "published",
  startsAt: "2026-06-18T18:00:00.000Z",
  rsvpCloseAt: "2026-06-10T18:00:00.000Z",
  segmentOptions: [{ value: "full_evening", label: "Full evening" }],
  micrositeUrl: "https://event.lax.bid/lax001",
  venue: "Brunswick Art Gallery",
  dressCode: null,
  arrivalNote: null,
  opsEmail: "events@lax.bid",
  checkInDryRun: false,
  rsvpCount: 1,
  checkedInCount: 0,
  saleId: "sale-1",
};

const rsvp: OnsiteEventRsvpAdminRow = {
  id: "rsvp-1",
  name: "Ada Lovelace",
  email: "ada@example.com",
  attendanceSegment: "full_evening",
  plusOne: 0,
  plusOneGuestName: null,
  notes: null,
  checkedInAt: null,
  checkInPartyCount: null,
  createdAt: "2026-06-01T10:00:00.000Z",
  updatedAt: "2026-06-02T10:00:00.000Z",
};

describe("OnsiteEventDetail", () => {
  it("leads with check-in and offers the event's other actions beside it", () => {
    render(<OnsiteEventDetail event={event} rsvps={[rsvp]} linkedSaleTitle="Summer sale" />);

    expect(screen.getByRole("heading", { name: "Opening evening" })).toBeInTheDocument();
    expect(screen.getByText("Published")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Open check-in" })).toHaveAttribute(
      "href",
      "/admin/event-rsvps/lax001/check-in",
    );
    expect(screen.getByRole("link", { name: "Edit event" })).toHaveAttribute(
      "href",
      "/admin/event-rsvps/lax001/edit",
    );
  });

  it("names the linked sale and shows the event day counts", () => {
    render(
      <OnsiteEventDetail
        event={event}
        rsvps={[rsvp]}
        linkedSaleTitle="Summer sale"
        venueDayCounts={{ rsvped: 1, galaCheckedIn: 0, salePresent: 0, paddled: 0 }}
      />,
    );
    const summary = screen.getByRole("region", { name: "Summary" });
    const sale = within(summary).getByRole("link", { name: "Summer sale" });
    expect(sale).toHaveAttribute("href", "/admin/sales/sale-1");
    expect(sale.className).toContain("underline");
    const counts = screen.getByRole("region", { name: "Event day counts" });
    expect(within(counts).getByText("Paddles issued")).toBeInTheDocument();
  });

  it("shows the guest list and a dry run notice", () => {
    render(<OnsiteEventDetail event={{ ...event, checkInDryRun: true }} rsvps={[rsvp]} />);
    expect(screen.getByText("Check-in is in dry run")).toBeInTheDocument();
    expect(screen.getByRole("table", { name: "Guest list" })).toBeInTheDocument();
  });

  it("says when the guest list did not load, without hiding the event", () => {
    render(<OnsiteEventDetail event={event} rsvps={[]} loadError="Could not load RSVPs." />);
    expect(screen.getByText("The guest list did not load")).toBeInTheDocument();
    expect(screen.getByText("Could not load RSVPs.")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Opening evening" })).toBeInTheDocument();
  });
});

describe("OnsiteEventUnavailable", () => {
  it("explains the failure and offers to try again", () => {
    render(<OnsiteEventUnavailable message="The server did not answer." />);
    expect(screen.getByText("This event did not load")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Try again" })).toBeInTheDocument();
  });
});
