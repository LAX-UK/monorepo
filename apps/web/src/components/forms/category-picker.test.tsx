import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { CategoryPicker } from "./category-picker";

describe("CategoryPicker trigger", () => {
  it("is an underline field, like the inputs around it in the sell form", () => {
    render(<CategoryPicker categories={[]} value={[]} onChange={vi.fn()} />);
    const triggers = screen.getAllByRole("button", { name: /select categories/i });
    expect(triggers.length).toBeGreaterThan(0);
    for (const trigger of triggers) {
      expect(trigger).toHaveClass("border-b", "rounded-none", "bg-transparent");
      expect(trigger.className).not.toMatch(/rounded-md|shadow-sm|uppercase/);
    }
  });
});
