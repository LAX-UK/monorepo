import {
  DESK_BOOKING,
  DESK_VENUE,
  deskBooking,
  deskDay,
} from "@/lib/admin/collections/desk.fixture";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const refresh = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh }) }));

const rebook = vi.fn();
const loadDay = vi.fn();
vi.mock("@/lib/actions/admin/admin-collection-desk", () => ({
  rebookCollectionAction: (...a: unknown[]) => rebook(...a),
  loadDeskDayAction: (...a: unknown[]) => loadDay(...a),
}));
vi.mock("@/lib/auth/step-up/staff-step-up.client", () => ({ handleStaffStepUp: () => false }));

const { DeskRebookDialog } = await import("./desk-rebook-dialog");

const OPEN = {
  start: "2026-11-13T10:00:00.000Z",
  end: "2026-11-13T10:30:00.000Z",
  taken: 0,
  capacity: 2,
  bookings: [],
};
const FULL = {
  start: "2026-11-13T11:00:00.000Z",
  end: "2026-11-13T11:30:00.000Z",
  taken: 2,
  capacity: 2,
  bookings: [],
};

beforeEach(() => {
  vi.clearAllMocks();
  loadDay.mockResolvedValue({
    ok: true,
    data: deskDay({ date: "2026-11-13", groups: [OPEN, FULL] }),
  });
});

const draw = (booking = deskBooking()) => {
  const onClose = vi.fn();
  render(
    <DeskRebookDialog
      booking={booking}
      venueId={DESK_VENUE}
      today="2026-11-09"
      onClose={onClose}
    />,
  );
  return onClose;
};

describe("rebooking at the desk", () => {
  it("shows the day's times with the places taken, and says a full time needs a reason", async () => {
    draw();
    expect(await screen.findByRole("radio", { name: /10:00–10:30/ })).toBeTruthy();
    expect(screen.getByText("0 of 2 booked")).toBeTruthy();
    expect(screen.getByText("2 of 2 booked · needs a reason")).toBeTruthy();
  });

  it("asks for a time before sending anything", async () => {
    draw();
    await screen.findByRole("radio", { name: /10:00–10:30/ });
    fireEvent.click(screen.getByRole("button", { name: "Move booking" }));
    expect(await screen.findByText("Choose a time.")).toBeTruthy();
    expect(rebook).not.toHaveBeenCalled();
  });

  it("moves the visit with the version it was read at", async () => {
    rebook.mockResolvedValue({ ok: true, data: deskBooking() });
    const onClose = draw(deskBooking({ version: 3 }));
    fireEvent.click(await screen.findByRole("radio", { name: /10:00–10:30/ }));
    fireEvent.click(screen.getByRole("button", { name: "Move booking" }));
    await waitFor(() => expect(rebook).toHaveBeenCalledTimes(1));
    expect(rebook).toHaveBeenCalledWith(DESK_BOOKING, {
      version: 3,
      slotStart: OPEN.start,
    });
    await waitFor(() => expect(onClose).toHaveBeenCalled());
    expect(refresh).toHaveBeenCalled();
  });

  it("needs a reason to take a full time, and sends it", async () => {
    rebook.mockResolvedValue({ ok: true, data: deskBooking() });
    draw();
    fireEvent.click(await screen.findByRole("radio", { name: /11:00–11:30/ }));
    const reason = await screen.findByRole("textbox", { name: /Reason/ });
    fireEvent.click(screen.getByRole("button", { name: "Move booking" }));
    expect(await screen.findByText(/Give a reason/)).toBeTruthy();
    expect(rebook).not.toHaveBeenCalled();
    fireEvent.change(reason, { target: { value: "Client flying out Thursday" } });
    fireEvent.click(screen.getByRole("button", { name: "Move booking" }));
    await waitFor(() => expect(rebook).toHaveBeenCalledTimes(1));
    expect(rebook.mock.calls[0]?.[1]).toMatchObject({
      slotStart: FULL.start,
      override: { reason: "Client flying out Thursday" },
    });
  });

  it("asks for a reason when the server says the time is inside the notice period", async () => {
    rebook.mockResolvedValue({
      ok: false,
      error: "inside notice",
      errorCode: "notice_passed",
      status: 422,
    });
    draw();
    fireEvent.click(await screen.findByRole("radio", { name: /10:00–10:30/ }));
    fireEvent.click(screen.getByRole("button", { name: "Move booking" }));
    expect(await screen.findByRole("textbox", { name: /Reason/ })).toBeTruthy();
    expect(
      screen.getByText(/needs a reason|Add a reason/i, { selector: "[id$=-error]" }),
    ).toBeTruthy();
  });

  it("books a new time after a missed visit", async () => {
    draw(deskBooking({ status: "not_collected", actions: ["rebook"] }));
    expect(await screen.findByRole("heading", { name: "Book a new time" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Book this time" })).toBeTruthy();
  });

  it("offers a retry when the times cannot be loaded", async () => {
    loadDay.mockResolvedValue({ ok: false, error: "x" });
    draw();
    expect(await screen.findByText("We couldn't load the times")).toBeTruthy();
    loadDay.mockResolvedValue({ ok: true, data: deskDay({ groups: [OPEN] }) });
    fireEvent.click(screen.getByRole("button", { name: "Try again" }));
    expect(await screen.findByRole("radio", { name: /10:00–10:30/ })).toBeTruthy();
  });

  it("says a closed day is closed", async () => {
    loadDay.mockResolvedValue({ ok: true, data: deskDay({ state: "closed", groups: [] }) });
    draw();
    expect(await screen.findByText(/is closed/)).toBeTruthy();
  });
});
