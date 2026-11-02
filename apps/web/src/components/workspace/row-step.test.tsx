import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { RowStep } from "./row-step";

describe("RowStep", () => {
  it("opens a page from a secondary button link named for its record", () => {
    render(<RowStep label="Choose" accessibleName="Choose, Quiet Tide" href="/selling/c/1" />);
    const link = screen.getByRole("link", { name: "Choose, Quiet Tide" });
    expect(link).toHaveAttribute("href", "/selling/c/1");
    expect(link).toHaveTextContent("Choose");
  });

  it("runs a handler when the step is taken in place", () => {
    const onSelect = vi.fn();
    render(
      <RowStep
        label="Pay £1,875.00"
        accessibleName="Pay £1,875.00, Red Kite"
        onSelect={onSelect}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: "Pay £1,875.00, Red Kite" }));
    expect(onSelect).toHaveBeenCalledOnce();
  });

  it("stays in view while held and keeps the reason", () => {
    render(
      <RowStep
        label="Make changes"
        accessibleName="Make changes, Dusk"
        href="/x"
        blockedReason="Selling is paused."
      />,
    );
    expect(screen.queryByRole("link")).toBeNull();
    const button = screen.getByRole("button", { name: "Make changes, Dusk" });
    expect(button).toHaveAttribute("aria-disabled", "true");
  });
});
