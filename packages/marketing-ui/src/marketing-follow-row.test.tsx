import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { MarketingFollowRow } from "./marketing-follow-row.js";

describe("MarketingFollowRow", () => {
  it("renders the linked name, caption and action", () => {
    render(
      <MarketingFollowRow
        name="Ada Lane"
        href="/artists/ada-lane"
        caption="British, 1924–2001"
        action={<button type="button">Following</button>}
      />,
    );
    expect(screen.getByRole("link", { name: "Ada Lane" })).toHaveAttribute(
      "href",
      "/artists/ada-lane",
    );
    expect(screen.getByText("British, 1924–2001")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Following" })).toBeInTheDocument();
  });

  it("falls back to initials and omits an empty caption", () => {
    const { container } = render(<MarketingFollowRow name="Ada Lane" href="/a" />);
    expect(screen.getByText("AL")).toBeInTheDocument();
    expect(container.querySelector("p")).toBeNull();
  });

  it("shows the supplied portrait instead of initials", () => {
    render(<MarketingFollowRow name="Ada Lane" href="/a" avatar={<span>portrait</span>} />);
    expect(screen.queryByText("AL")).toBeNull();
    expect(screen.getByText("portrait")).toBeInTheDocument();
  });
});
