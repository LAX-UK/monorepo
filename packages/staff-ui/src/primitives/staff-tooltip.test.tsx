import { render, screen } from "@testing-library/react";
import type * as React from "react";
import { describe, expect, it, vi } from "vitest";

// Positioning is not under test; the stand-in renders the content open with its classes.
vi.mock("@auction/ui/components/tooltip", () => ({
  TooltipProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  Tooltip: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  TooltipTrigger: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  TooltipContent: ({ children, className }: { children: React.ReactNode; className?: string }) => (
    <div role="tooltip" className={className}>
      {children}
    </div>
  ),
}));

const { StaffTooltip } = await import("./menu.js");

describe("StaffTooltip", () => {
  it("keeps a short label on one line", () => {
    render(
      <StaffTooltip label="Copy ID">
        <button type="button">Copy</button>
      </StaffTooltip>,
    );
    expect(screen.getByRole("tooltip").className).not.toContain("max-w-80");
  });

  it("wraps a sentence at a fixed width when multiline", () => {
    render(
      <StaffTooltip label="Bidding happens on another site." multiline>
        <button type="button">Where</button>
      </StaffTooltip>,
    );
    expect(screen.getByRole("tooltip").className).toContain("max-w-80");
  });
});
