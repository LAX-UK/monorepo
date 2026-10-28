import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { HoverCard, HoverCardContent, HoverCardTrigger } from "./hover-card.js";

describe("HoverCardContent", () => {
  it("uses the soft menu border by default, like the popover", () => {
    render(
      <HoverCard open>
        <HoverCardTrigger>Artist</HoverCardTrigger>
        <HoverCardContent>About the artist</HoverCardContent>
      </HoverCard>,
    );
    expect(screen.getByText("About the artist")).toHaveClass("border", "border-outline-variant/20");
  });
});
