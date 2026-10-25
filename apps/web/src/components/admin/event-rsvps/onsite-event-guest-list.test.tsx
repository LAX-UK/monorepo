import type { OnsiteEventRsvpAdminRow, OnsiteEventSegmentOption } from "@auction/types";
import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { OnsiteEventGuestList, partyLabel, segmentLabel } from "./onsite-event-guest-list";

vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn(), push: vi.fn() }) }));
vi.mock("@/lib/data/http/onsite-event-check-in.client", () => ({
  resendOnsiteEventPass: vi.fn(),
}));
vi.mock("@/lib/auth/step-up/use-step-up-coordinator", () => ({
  redirectToHostedReauth: vi.fn(),
}));

const segments: OnsiteEventSegmentOption[] = [
  { value: "full_evening", label: "Full evening" },
  { value: "auction_only", label: "Auction only" },
];

function row(over: Partial<OnsiteEventRsvpAdminRow>): OnsiteEventRsvpAdminRow {
  return {
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
    ...over,
  };
}

const rsvps = [
  row({}),
  row({
    id: "rsvp-2",
    name: "Grace Hopper",
    email: "grace@example.com",
    attendanceSegment: "auction_only",
    plusOne: 1,
    plusOneGuestName: "Alan Turing",
    checkedInAt: "2026-06-18T18:30:00.000Z",
  }),
];

function renderList(data = rsvps) {
  return render(
    <OnsiteEventGuestList slug="preview-night" rsvps={data} segmentOptions={segments} />,
  );
}

describe("guest list labels", () => {
  it("names the attendance option and never shows a stored key", () => {
    expect(segmentLabel(segments, "auction_only")).toBe("Auction only");
    expect(segmentLabel(segments, "retired_option")).toBe("Other");
  });

  it("says who comes with the guest in words", () => {
    expect(partyLabel({ plusOne: 0, plusOneGuestName: null })).toBe("Guest only");
    expect(partyLabel({ plusOne: 1, plusOneGuestName: "Alan Turing" })).toBe(
      "Plus-one: Alan Turing",
    );
    expect(partyLabel({ plusOne: 1, plusOneGuestName: " " })).toBe("Plus-one");
  });
});

describe("OnsiteEventGuestList", () => {
  it("lists each guest with their attendance, party and arrival", () => {
    renderList();
    const table = screen.getByRole("table", { name: "Guest list" });
    expect(within(table).getByText("Ada Lovelace")).toBeInTheDocument();
    expect(within(table).getByText("Auction only")).toBeInTheDocument();
    expect(within(table).getByText("Plus-one: Alan Turing")).toBeInTheDocument();
    expect(within(table).getByText("Arrived")).toBeInTheDocument();
    expect(within(table).getByText("Not arrived")).toBeInTheDocument();
    expect(screen.getByText("1 of 2 arrived")).toBeInTheDocument();
  });

  it("filters by search and offers to clear when nothing matches", async () => {
    renderList();
    fireEvent.change(screen.getByRole("searchbox", { name: "Search guests" }), {
      target: { value: "nobody" },
    });
    expect(await screen.findByText("No guests match")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Clear search and filters" }));
    const table = await screen.findByRole("table", { name: "Guest list" });
    expect(within(table).getByText("Ada Lovelace")).toBeInTheDocument();
  });

  it("says so when nobody has responded", () => {
    renderList([]);
    expect(screen.getByText("No RSVPs yet")).toBeInTheDocument();
  });

  it("gives every guest a visible actions menu", () => {
    renderList();
    const table = screen.getByRole("table", { name: "Guest list" });
    expect(within(table).getByRole("button", { name: "Actions for Ada Lovelace" })).toBeVisible();
    expect(within(table).getByRole("button", { name: "Actions for Grace Hopper" })).toBeVisible();
  });
});
