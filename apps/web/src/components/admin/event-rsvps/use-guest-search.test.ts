import { searchOnsiteEventGuests } from "@/lib/data/http/onsite-event-check-in.client";
import type { OnsiteEventCheckInSearchRow } from "@auction/types";
import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useGuestSearch } from "./use-guest-search";

vi.mock("@/lib/data/http/onsite-event-check-in.client", () => ({
  searchOnsiteEventGuests: vi.fn(),
}));

const SLUG = "preview-night";

const searchRow: OnsiteEventCheckInSearchRow = {
  rsvpId: "10000000-0000-4000-8000-000000000001",
  name: "Ada Lovelace",
  email: "ada@example.com",
  attendanceSegment: "vip",
  attendanceSegmentLabel: "VIP",
  plusOne: 0,
  plusOneGuestName: null,
  checkedInAt: null,
};

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(searchOnsiteEventGuests).mockResolvedValue([searchRow]);
});

afterEach(() => {
  vi.useRealTimers();
});

describe("useGuestSearch", () => {
  it("debounces search and returns rows", async () => {
    vi.useFakeTimers();
    const { result } = renderHook(() => useGuestSearch(SLUG));

    act(() => {
      result.current.setSearchQuery("Ada");
    });

    await act(async () => {
      await vi.advanceTimersByTimeAsync(300);
    });

    expect(searchOnsiteEventGuests).toHaveBeenCalledWith(SLUG, "Ada");
    expect(result.current.searchResults).toEqual([searchRow]);
  });

  it("clears results when query is too short", () => {
    const { result } = renderHook(() => useGuestSearch(SLUG));

    act(() => {
      result.current.setSearchQuery("A");
    });

    expect(result.current.searchResults).toEqual([]);
    expect(searchOnsiteEventGuests).not.toHaveBeenCalled();
  });

  it("ignores stale responses when query changes quickly", async () => {
    vi.useFakeTimers();
    let resolveFirst: (rows: OnsiteEventCheckInSearchRow[]) => void = () => undefined;
    const firstPromise = new Promise<OnsiteEventCheckInSearchRow[]>((resolve) => {
      resolveFirst = resolve;
    });
    vi.mocked(searchOnsiteEventGuests)
      .mockReturnValueOnce(firstPromise)
      .mockResolvedValueOnce([]);

    const { result } = renderHook(() => useGuestSearch(SLUG));

    act(() => {
      result.current.setSearchQuery("Ada");
    });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(300);
    });

    act(() => {
      result.current.setSearchQuery("Bob");
    });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(300);
    });

    resolveFirst([searchRow]);
    await act(async () => {
      await Promise.resolve();
    });

    expect(result.current.searchResults).toEqual([]);
  });
});
