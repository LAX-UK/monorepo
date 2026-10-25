import {
  checkInOnsiteEventGuest,
  fetchOnsiteEventCheckInStats,
  searchOnsiteEventGuests,
  setOnsiteEventCheckInDryRun,
} from "@/lib/data/http/onsite-event-check-in.client";
import type { OnsiteEventCheckInResult, OnsiteEventCheckInSearchRow } from "@auction/types";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { OnsiteEventCheckInConsole } from "./check-in-console";
import { resultTitle, resultTone } from "./check-in-result-banner";

vi.mock("@/lib/data/http/onsite-event-check-in.client", () => ({
  checkInOnsiteEventGuest: vi.fn(),
  fetchOnsiteEventCheckInStats: vi.fn(),
  searchOnsiteEventGuests: vi.fn(),
  setOnsiteEventCheckInDryRun: vi.fn(),
}));

const SLUG = "preview-night";

const guest = {
  rsvpId: "10000000-0000-4000-8000-000000000001",
  name: "Ada Lovelace",
  email: "ada@example.com",
  attendanceSegment: "vip",
  attendanceSegmentLabel: "VIP",
  plusOne: 0,
  plusOneGuestName: null,
  partySize: 1,
  checkedInAt: null,
  checkedInByName: null,
};

const validResult: OnsiteEventCheckInResult = { status: "VALID", guest };

const searchRow: OnsiteEventCheckInSearchRow = {
  rsvpId: guest.rsvpId,
  name: guest.name,
  email: guest.email,
  attendanceSegment: guest.attendanceSegment,
  attendanceSegmentLabel: guest.attendanceSegmentLabel,
  plusOne: guest.plusOne,
  plusOneGuestName: guest.plusOneGuestName,
  checkedInAt: null,
};

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(fetchOnsiteEventCheckInStats).mockResolvedValue({
    total: 10,
    checkedIn: 3,
    checkInDryRun: false,
  });
  vi.mocked(checkInOnsiteEventGuest).mockResolvedValue(validResult);
  vi.mocked(searchOnsiteEventGuests).mockResolvedValue([searchRow]);
  vi.mocked(setOnsiteEventCheckInDryRun).mockResolvedValue(true);
});

describe("result presentation helpers", () => {
  it.each([
    ["VALID", "Admit: checked in", "success"],
    ["DRY_RUN_VALID", "Admit: dry run, not recorded", "success"],
    ["ALREADY_CHECKED_IN", "Already checked in", "warning"],
    ["INVALID", "Pass not recognised", "danger"],
    ["WRONG_EVENT", "Wrong event", "danger"],
    ["EVENT_CLOSED", "Check-in closed", "danger"],
  ] as const)("maps %s to title and tone", (status, title, tone) => {
    const result =
      status === "INVALID" || status === "WRONG_EVENT" || status === "EVENT_CLOSED"
        ? ({ status } as OnsiteEventCheckInResult)
        : ({ status, guest } as OnsiteEventCheckInResult);
    expect(resultTitle(result)).toBe(title);
    expect(resultTone(status)).toBe(tone);
  });
});

describe("OnsiteEventCheckInConsole", () => {
  it("renders the title, arrival counts and a live badge", async () => {
    render(<OnsiteEventCheckInConsole slug={SLUG} title="Preview Night" />);
    expect(screen.getByRole("heading", { name: "Preview Night check-in" })).toBeInTheDocument();
    await waitFor(() => {
      expect(screen.getByText("3 of 10")).toBeInTheDocument();
    });
    expect(screen.getByText("Live")).toBeInTheDocument();
    const strip = screen.getByRole("region", { name: "Arrivals" });
    expect(within(strip).getByText("Still to arrive")).toBeInTheDocument();
    expect(within(strip).getByText("7")).toBeInTheDocument();
  });

  it("checks in via a pasted token and shows the guest", async () => {
    render(<OnsiteEventCheckInConsole slug={SLUG} title="Preview Night" />);

    const input = screen.getByLabelText(/paste a pass link/i);
    fireEvent.change(input, { target: { value: "token-abc" } });
    fireEvent.click(screen.getByRole("button", { name: "Check in" }));

    await waitFor(() => {
      expect(checkInOnsiteEventGuest).toHaveBeenCalledWith(SLUG, { token: "token-abc" });
    });
    expect(await screen.findByText("Admit: checked in")).toBeInTheDocument();
    expect(screen.getByText("Ada Lovelace")).toBeInTheDocument();
  });

  it("leaves Check in inert, and says why, until a token is pasted", () => {
    render(<OnsiteEventCheckInConsole slug={SLUG} title="Preview Night" />);
    const button = screen.getByRole("button", { name: "Check in" });
    expect(button).toHaveAttribute("aria-disabled", "true");
    fireEvent.click(button);
    expect(checkInOnsiteEventGuest).not.toHaveBeenCalled();
  });

  it("shows a network error on check-in failure", async () => {
    vi.mocked(checkInOnsiteEventGuest).mockRejectedValue(new Error("network down"));
    render(<OnsiteEventCheckInConsole slug={SLUG} title="Preview Night" />);

    fireEvent.change(screen.getByLabelText(/paste a pass link/i), {
      target: { value: "bad-token" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Check in" }));

    await waitFor(() => {
      expect(screen.getByText("Could not reach the server")).toBeInTheDocument();
    });
    expect(screen.getByRole("alert")).toHaveTextContent("network down");
  });

  it("turns dry run on from the header", async () => {
    render(<OnsiteEventCheckInConsole slug={SLUG} title="Preview Night" />);

    fireEvent.click(await screen.findByRole("button", { name: "Turn on dry run" }));

    await waitFor(() => {
      expect(setOnsiteEventCheckInDryRun).toHaveBeenCalledWith(SLUG, true);
    });
  });

  it("asks before going live and only then turns dry run off", async () => {
    vi.mocked(fetchOnsiteEventCheckInStats).mockResolvedValue({
      total: 10,
      checkedIn: 3,
      checkInDryRun: true,
    });
    render(<OnsiteEventCheckInConsole slug={SLUG} title="Preview Night" />);

    fireEvent.click(await screen.findByRole("button", { name: "Go live" }));
    expect(screen.getByText("Go live with check-in?")).toBeInTheDocument();
    expect(setOnsiteEventCheckInDryRun).not.toHaveBeenCalled();

    const dialog = screen.getByRole("dialog");
    fireEvent.click(within(dialog).getByRole("button", { name: "Go live" }));
    await waitFor(() => {
      expect(setOnsiteEventCheckInDryRun).toHaveBeenCalledWith(SLUG, false);
    });
  });

  it("shows camera unavailable when BarcodeDetector is absent", async () => {
    render(<OnsiteEventCheckInConsole slug={SLUG} title="Preview Night" />);
    await waitFor(() => {
      expect(
        screen.getByText(/Camera scanning is unavailable on this device/i),
      ).toBeInTheDocument();
    });
  });

  it("submits the pasted token with Enter", async () => {
    render(<OnsiteEventCheckInConsole slug={SLUG} title="Preview Night" />);
    const input = screen.getByLabelText(/paste a pass link/i);
    fireEvent.change(input, { target: { value: "enter-token" } });
    const form = input.closest("form");
    if (!form) throw new Error("expected the token field to sit in a form");
    fireEvent.submit(form);

    await waitFor(() => {
      expect(checkInOnsiteEventGuest).toHaveBeenCalledWith(SLUG, { token: "enter-token" });
    });
  });

  it("searches by name and checks the guest in", async () => {
    render(<OnsiteEventCheckInConsole slug={SLUG} title="Preview Night" />);

    fireEvent.click(screen.getByRole("radio", { name: "Search name" }));
    fireEvent.change(screen.getByLabelText("Search guests"), { target: { value: "ada" } });

    fireEvent.click(await screen.findByRole("button", { name: "Check in Ada Lovelace" }));
    await waitFor(() => {
      expect(checkInOnsiteEventGuest).toHaveBeenCalledWith(SLUG, { rsvpId: guest.rsvpId });
    });
  });
});
