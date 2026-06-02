import { LotBidModeChooser } from "@/components/sections/artwork/redesign/lot-bid-mode-chooser";
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

describe("LotBidModeChooser", () => {
  it("renders both mode labels and full subtitle copy", () => {
    render(<LotBidModeChooser mode="auto" onModeChange={() => {}} />);

    expect(screen.getByText("Auto-bid")).toBeInTheDocument();
    expect(screen.getByText("Place one bid now")).toBeInTheDocument();
    expect(
      screen.getByText(
        "Set your max. We bid the minimum needed to keep you in front, up to your max.",
      ),
    ).toBeInTheDocument();
    expect(
      screen.getByText(
        "Choose a single amount. You'll need to come back if another bidder goes higher.",
      ),
    ).toBeInTheDocument();
  });

  it("marks the selected mode with aria-pressed", () => {
    render(<LotBidModeChooser mode="manual" onModeChange={() => {}} />);

    expect(screen.getByRole("button", { name: /Auto-bid/i })).toHaveAttribute(
      "aria-pressed",
      "false",
    );
    expect(screen.getByRole("button", { name: /Place one bid now/i })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
  });

  it("calls onModeChange when a card is clicked", () => {
    const onModeChange = vi.fn();
    render(<LotBidModeChooser mode="auto" onModeChange={onModeChange} />);

    fireEvent.click(screen.getByRole("button", { name: /Place one bid now/i }));
    expect(onModeChange).toHaveBeenCalledWith("manual");
  });

  it("applies layout classes that prevent subtitle overflow", () => {
    render(<LotBidModeChooser mode="auto" onModeChange={() => {}} />);

    for (const button of screen.getAllByRole("button")) {
      expect(button.className).toMatch(/\bw-full\b/);
      expect(button.className).toMatch(/\bmin-w-0\b/);
      expect(button.className).toMatch(/\bwhitespace-normal\b/);
      expect(button.className).toMatch(/\bflex-col\b/);
    }
  });
});
