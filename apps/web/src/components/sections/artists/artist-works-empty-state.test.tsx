import { render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";
import { ArtistOnSaleEmptyState, ArtistResultsEmptyState } from "./artist-works-empty-state";

vi.mock("next/link", () => ({
  default: ({
    children,
    href,
    ...rest
  }: { children: ReactNode; href: string } & Record<string, unknown>) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));

const base = {
  artistId: "artist-1",
  artistName: "Henry Lisle",
  loginNextPath: "/artist/henry-lisle/artist-1",
};

describe("ArtistOnSaleEmptyState", () => {
  it("offers follow as the main action to a visitor, with sign-in first and no eye icon", () => {
    render(<ArtistOnSaleEmptyState {...base} watching={false} isAuthenticated={false} />);

    expect(
      screen.getByRole("heading", { name: "No works by Henry Lisle are on sale" }),
    ).toBeInTheDocument();
    const follow = screen.getByRole("link", { name: "Follow artist" });
    expect(follow.getAttribute("href")).toContain("next=");
    expect(screen.getByRole("link", { name: "Sell a work by this artist" })).toHaveAttribute(
      "href",
      "/selling/new",
    );
    expect(screen.queryByText("Sign in to follow")).not.toBeInTheDocument();
  });

  it("tells a follower they already follow the artist", () => {
    render(<ArtistOnSaleEmptyState {...base} watching isAuthenticated />);

    expect(screen.getByText(/You follow Henry Lisle/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Following" })).toBeInTheDocument();
  });
});

describe("ArtistResultsEmptyState", () => {
  it("says no results and points to past auctions", () => {
    render(<ArtistResultsEmptyState artistName="Henry Lisle" />);

    expect(screen.getByText("No past results for Henry Lisle")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Browse past auctions" })).toBeInTheDocument();
  });
});
