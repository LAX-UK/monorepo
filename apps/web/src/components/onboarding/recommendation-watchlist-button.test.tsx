import { RecommendationWatchlistButton } from "@/components/onboarding/recommendation-watchlist-button";
import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  toggle: vi.fn(),
  state: {
    watching: false,
    busy: false,
    error: null as string | null,
    announce: null as string | null,
  },
}));
vi.mock("@/lib/watchlist/use-watchlist-toggle", () => ({
  useWatchlistToggle: () => ({ ...mocks.state, toggle: mocks.toggle }),
}));

describe("RecommendationWatchlistButton", () => {
  beforeEach(() => {
    mocks.toggle.mockReset();
    Object.assign(mocks.state, { watching: false, busy: false, error: null, announce: null });
  });

  it("toggles through an accurately labelled pressed control", () => {
    render(
      <RecommendationWatchlistButton
        lotId="lot-1"
        lotTitle="Blue Study"
        initialWatching={false}
        loginNextPath="/onboarding/recommendations"
      />,
    );
    const button = screen.getByRole("button", { name: "Add Blue Study to watchlist" });
    expect(button).toHaveAttribute("aria-pressed", "false");
    fireEvent.click(button);
    expect(mocks.toggle).toHaveBeenCalledOnce();
  });

  it("announces state and errors while preventing duplicate interaction", () => {
    Object.assign(mocks.state, {
      watching: true,
      busy: true,
      error: "Watchlist could not be updated",
    });
    render(
      <RecommendationWatchlistButton
        lotId="lot-1"
        lotTitle="Blue Study"
        initialWatching
        loginNextPath="/onboarding/recommendations"
      />,
    );
    expect(screen.getByRole("button", { name: "Remove Blue Study from watchlist" })).toBeDisabled();
    expect(screen.getByText("Watchlist could not be updated")).toHaveAttribute(
      "aria-live",
      "polite",
    );
  });
});
