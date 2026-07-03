import { OnsiteEventForm } from "@/components/admin/event-rsvps/onsite-event-form";
import type { OnsiteEventAdminDetail } from "@auction/types";
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/actions/admin/admin-onsite-event", () => ({
  adminCreateOnsiteEventAction: vi.fn(),
  adminUpdateOnsiteEventAction: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: vi.fn(), push: vi.fn(), back: vi.fn() }),
}));

const editInitial: OnsiteEventAdminDetail = {
  slug: "lax001",
  title: "Opening evening",
  status: "published",
  startsAt: "2026-06-18T18:00:00.000Z",
  rsvpCloseAt: "2099-01-01T00:00:00.000Z",
  segmentOptions: [
    { value: "full_evening", label: "Full evening" },
    { value: "auction_only", label: "Auction only", helper: "From 7pm" },
  ],
  micrositeUrl: "https://event.lax.bid/lax001",
  venue: "Brunswick Art Gallery",
  dressCode: "Smart formal",
  arrivalNote: "Doors 6:00 PM",
  opsEmail: "events@lax.bid",
  checkInDryRun: false,
  rsvpCount: 12,
  checkedInCount: 4,
  saleId: null,
};

describe("OnsiteEventForm", () => {
  it("round-trips opsEmail, dressCode, arrivalNote, and segment labels in edit mode", () => {
    render(<OnsiteEventForm mode="edit" initial={editInitial} />);

    expect(screen.getByLabelText("Ops email")).toHaveValue("events@lax.bid");
    expect(screen.getByLabelText("Dress code")).toHaveValue("Smart formal");
    expect(screen.getByLabelText("Arrival note")).toHaveValue("Doors 6:00 PM");
    expect(screen.getByLabelText("Segment 1 label")).toHaveValue("Full evening");
    expect(screen.getByLabelText("Segment 2 label")).toHaveValue("Auction only");
    expect(screen.getByLabelText("Segment 2 helper")).toHaveValue("From 7pm");
  });

  it("supports adding and removing attendance segments", () => {
    render(<OnsiteEventForm mode="edit" initial={editInitial} />);
    expect(screen.getAllByLabelText(/Segment \d label/i)).toHaveLength(2);

    fireEvent.click(screen.getByRole("button", { name: /Add segment/i }));
    expect(screen.getAllByLabelText(/Segment \d label/i)).toHaveLength(3);

    const removeButtons = screen.getAllByRole("button", { name: /Remove segment/i });
    const firstRemove = removeButtons[0];
    if (!firstRemove) throw new Error("expected remove segment button");
    fireEvent.click(firstRemove);
    expect(screen.getAllByLabelText(/Segment \d label/i)).toHaveLength(2);
    expect(screen.queryByDisplayValue("Full evening")).not.toBeInTheDocument();
  });
});
