/** @vitest-environment jsdom */
import { LaxHeroBetweenSeasons } from "@/components/sections/home/lax-hero-between-seasons";
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/components/sections/home/newsletter-signup-form", () => ({
  NewsletterSignupForm: () => <form aria-label="Newsletter sign-up" />,
}));

describe("LaxHeroBetweenSeasons", () => {
  it("states that the next sales are being prepared, with the sign-up as the one action", () => {
    render(<LaxHeroBetweenSeasons />);
    expect(
      screen.getByRole("heading", { level: 1, name: "Our next sales are being prepared" }),
    ).toBeInTheDocument();
    expect(screen.getByText("Auction calendar")).toBeInTheDocument();
    expect(screen.getByRole("form", { name: "Newsletter sign-up" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "See recent results" })).toHaveAttribute(
      "href",
      "/archive",
    );
  });

  it("shows no live status, bidding calls to action or lot data", () => {
    render(<LaxHeroBetweenSeasons />);
    expect(screen.queryByText(/auction in progress/i)).toBeNull();
    expect(screen.queryByText(/register to bid/i)).toBeNull();
    expect(screen.queryByText(/current bid/i)).toBeNull();
    expect(screen.queryByText(/lot —/i)).toBeNull();
  });
});
