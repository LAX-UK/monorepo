import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { Popover, PopoverContent, PopoverTrigger } from "./popover.js";

function renderOpen(className?: string) {
  render(
    <Popover open>
      <PopoverTrigger>Open</PopoverTrigger>
      <PopoverContent {...(className ? { className } : {})}>What this status means</PopoverContent>
    </Popover>,
  );
  return screen.getByText("What this status means");
}

describe("PopoverContent", () => {
  it("uses the soft menu border by default, not the text colour", () => {
    const content = renderOpen();
    expect(content).toHaveClass("border", "border-outline-variant/20");
  });

  it("lets a caller choose its own border colour", () => {
    const content = renderOpen("border-staff-line");
    expect(content).toHaveClass("border-staff-line");
    expect(content).not.toHaveClass("border-outline-variant/20");
  });
});
