import { DashboardFilterResultsAnnouncer } from "@/components/dashboard/filters/dashboard-filter-results-announcer";
import { act, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

describe("DashboardFilterResultsAnnouncer", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("debounces result announcements", async () => {
    const { rerender } = render(<DashboardFilterResultsAnnouncer count={5} entityLabel="lots" />);

    expect(screen.queryByText("5 lots")).not.toBeInTheDocument();

    await act(async () => {
      vi.advanceTimersByTime(400);
    });

    expect(screen.getByText("5 lots")).toBeInTheDocument();

    rerender(<DashboardFilterResultsAnnouncer count={0} entityLabel="lots" />);

    await act(async () => {
      vi.advanceTimersByTime(400);
    });

    expect(screen.getByText("No lots match your filters")).toBeInTheDocument();
  });
});
