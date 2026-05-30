import { ArtistFollowCard } from "@/components/dashboard/artist-follow/artist-follow-list";
import type { ArtistFollowCardVm } from "@/lib/data/artist-follow-card.vm";
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

const refresh = vi.fn();
const unfollow = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh }),
}));

vi.mock("@/lib/data/http/artist-watchlist.client", () => ({
  defaultArtistWatchlistClient: {
    follow: vi.fn(),
    unfollow: (...args: unknown[]) => unfollow(...args),
  },
}));

vi.mock("@/lib/shell/shell-config-context", () => ({
  useShellConfig: () => ({ density: "normal" }),
}));

const artist: ArtistFollowCardVm = {
  watchlistId: "w1",
  artistId: "artist-1",
  displayName: "Claude Monet",
  portraitUrl: null,
  shortBio: "Impressionist painter.",
  nationality: "French",
  birthYear: "1840",
  deathYear: "1926",
  kind: "artist",
  followedAtMs: Date.now() - 86_400_000,
};

describe("ArtistFollowCard", () => {
  it("renders artist name, meta, and unfollow heart", () => {
    render(<ArtistFollowCard artist={artist} variant="grid" />);

    expect(screen.getByRole("link", { name: "Claude Monet" })).toBeInTheDocument();
    expect(screen.getByText(/1840 – 1926 · French/)).toBeInTheDocument();
    expect(screen.getByText("Impressionist painter.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Unfollow Claude Monet" })).toBeInTheDocument();
  });

  it("hides the card and refreshes after a successful unfollow", async () => {
    unfollow.mockResolvedValue(true);
    render(<ArtistFollowCard artist={artist} variant="grid" />);

    fireEvent.click(screen.getByRole("button", { name: "Unfollow Claude Monet" }));

    await vi.waitFor(() => {
      expect(unfollow).toHaveBeenCalledWith("artist-1");
      expect(refresh).toHaveBeenCalled();
      expect(screen.queryByText("Claude Monet")).not.toBeInTheDocument();
    });
  });
});
