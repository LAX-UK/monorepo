import {
  checkInOnsiteEventGuest,
  fetchOnsiteEventCheckInStats,
  searchOnsiteEventGuests,
  setOnsiteEventCheckInDryRun,
} from "@/lib/data/http/onsite-event-check-in.client";
import type { OnsiteEventCheckInResult, OnsiteEventCheckInSearchRow } from "@auction/types";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
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
    ["VALID", "Admit — checked in", "border-emerald-500"],
    ["DRY_RUN_VALID", "Admit — dry run (not recorded)", "border-emerald-500"],
    ["ALREADY_CHECKED_IN", "Already checked in", "border-amber-500"],
    ["INVALID", "Pass not recognised", "border-red-500"],
    ["WRONG_EVENT", "Wrong event", "border-red-500"],
    ["EVENT_CLOSED", "Check-in closed", "border-red-500"],
  ] as const)("maps %s to title and tone", (status, title, toneClass) => {
    const result =
      status === "INVALID" || status === "WRONG_EVENT" || status === "EVENT_CLOSED"
        ? ({ status } as OnsiteEventCheckInResult)
        : ({ status, guest } as OnsiteEventCheckInResult);
    expect(resultTitle(result)).toBe(title);
    expect(resultTone(status)).toContain(toneClass);
  });
});

describe("OnsiteEventCheckInConsole", () => {
  it("renders title and arrival stats", async () => {
    render(<OnsiteEventCheckInConsole slug={SLUG} title="Preview Night" />);
    expect(screen.getByText("Preview Night")).toBeInTheDocument();
    await waitFor(() => {
      expect(screen.getByText("3 / 10 arrived")).toBeInTheDocument();
    });
  });

  it("checks in via manual token", async () => {
    render(<OnsiteEventCheckInConsole slug={SLUG} title="Preview Night" />);

    const input = screen.getByLabelText(/paste pass link/i);
    fireEvent.change(input, { target: { value: "token-abc" } });
    fireEvent.click(screen.getByRole("button", { name: "Check in" }));

    await waitFor(() => {
      expect(checkInOnsiteEventGuest).toHaveBeenCalledWith(SLUG, { token: "token-abc" });
    });
    expect(screen.getByText("Admit — checked in")).toBeInTheDocument();
    expect(screen.getByText("Ada Lovelace")).toBeInTheDocument();
  });

  it("shows network error on check-in failure", async () => {
    vi.mocked(checkInOnsiteEventGuest).mockRejectedValue(new Error("network down"));
    render(<OnsiteEventCheckInConsole slug={SLUG} title="Preview Night" />);

    fireEvent.change(screen.getByLabelText(/paste pass link/i), {
      target: { value: "bad-token" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Check in" }));

    await waitFor(() => {
      expect(screen.getByText("Could not reach the server")).toBeInTheDocument();
      expect(screen.getByText("network down")).toBeInTheDocument();
    });
  });

  it("enables dry-run mode from the header toggle", async () => {
    render(<OnsiteEventCheckInConsole slug={SLUG} title="Preview Night" />);

    await waitFor(() => screen.getByRole("button", { name: "Dry-run off" }));
    fireEvent.click(screen.getByRole("button", { name: "Dry-run off" }));

    await waitFor(() => {
      expect(setOnsiteEventCheckInDryRun).toHaveBeenCalledWith(SLUG, true);
    });
  });

  it("opens confirm dialog when turning off dry-run", async () => {
    vi.mocked(fetchOnsiteEventCheckInStats).mockResolvedValue({
      total: 10,
      checkedIn: 3,
      checkInDryRun: true,
    });
    render(<OnsiteEventCheckInConsole slug={SLUG} title="Preview Night" />);

    await waitFor(() => screen.getByRole("button", { name: "Dry-run on" }));
    fireEvent.click(screen.getByRole("button", { name: "Dry-run on" }));

    expect(screen.getByText("Go live with check-in?")).toBeInTheDocument();
  });

  it("shows camera unavailable when BarcodeDetector is absent", async () => {
    render(<OnsiteEventCheckInConsole slug={SLUG} title="Preview Night" />);
    await waitFor(() => {
      expect(
        screen.getByText(/Camera scanning is unavailable on this device/i),
      ).toBeInTheDocument();
    });
  });

  it("submits manual token on Enter key", async () => {
    render(<OnsiteEventCheckInConsole slug={SLUG} title="Preview Night" />);
    const input = screen.getByLabelText(/paste pass link/i);
    fireEvent.change(input, { target: { value: "enter-token" } });
    fireEvent.keyDown(input, { key: "Enter" });

    await waitFor(() => {
      expect(checkInOnsiteEventGuest).toHaveBeenCalledWith(SLUG, { token: "enter-token" });
    });
  });
});
