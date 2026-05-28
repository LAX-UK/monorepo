import { ArtworkWatchToggle } from "@/components/sections/artwork/artwork-watch-toggle";
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/watchlist/use-watchlist-toggle", () => ({
  useWatchlistToggle: () => ({
    watching: true,
    busy: false,
    error: null,
    announce: null,
    toggle: vi.fn(),
    loginHref: "/login?next=%2Flot%2F1",
  }),
}));

describe("ArtworkWatchToggle", () => {
  it("renders list-action appearance with Unwatch label and lot title aria-label", () => {
    render(
      <ArtworkWatchToggle
        lotId="l1"
        initialWatching
        isAuthenticated
        appearance="list-action"
        lotTitle="Blue Canvas Study"
        loginNextPath="/lot/1"
      />,
    );

    expect(screen.getByRole("button", { name: "Unwatch Blue Canvas Study" })).toHaveTextContent(
      "Unwatch",
    );
  });
});
