import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { CategoryPicker } from "./category-picker";

describe("CategoryPicker trigger", () => {
  it("is a boxed field, like the inputs around it in the sell form", () => {
    render(<CategoryPicker categories={[]} value={[]} onChange={vi.fn()} />);
    const triggers = screen.getAllByRole("button", { name: /select categories/i });
    expect(triggers.length).toBeGreaterThan(0);
    for (const trigger of triggers) {
      expect(trigger).toHaveClass("border", "border-input-border", "rounded-md");
      expect(trigger.className).not.toMatch(/border-b |rounded-none|uppercase|text-2xl/);
    }
  });

  it("hands the overlay its open handlers, so a click opens the list", () => {
    render(<CategoryPicker categories={[]} value={[]} onChange={vi.fn()} />);
    for (const trigger of screen.getAllByRole("button", { name: /select categories/i })) {
      // Radix sets these on the trigger only when its props reach the button.
      expect(trigger).toHaveAttribute("aria-haspopup", "dialog");
      expect(trigger).toHaveAttribute("aria-expanded", "false");
    }
  });
});
