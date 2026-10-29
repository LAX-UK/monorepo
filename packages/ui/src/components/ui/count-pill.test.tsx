import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { CountPill, formatCountPill } from "./count-pill.js";

describe("CountPill", () => {
  it("is a 20px digits-only pill with tabular figures", () => {
    render(<CountPill value={3} />);
    expect(screen.getByText("3")).toHaveClass("h-5", "min-w-5", "rounded-full", "tabular-nums");
  });

  it.each([0, -1, Number.NaN])("renders nothing for %s", (value) => {
    const { container } = render(<CountPill value={value} />);
    expect(container).toBeEmptyDOMElement();
  });

  it("caps long counts at 99+", () => {
    expect(formatCountPill(99)).toBe("99");
    expect(formatCountPill(100)).toBe("99+");
  });

  it("reads its label after the number", () => {
    render(<CountPill value={2} label="waiting" />);
    expect(screen.getByText("2").textContent).toBe("2 waiting");
    expect(screen.getByText("waiting")).toHaveClass("sr-only");
  });

  it("uses an ink fill for counts that need attention", () => {
    render(<CountPill value={4} tone="attention" />);
    expect(screen.getByText("4")).toHaveClass("bg-on-surface", "text-surface");
  });
});
