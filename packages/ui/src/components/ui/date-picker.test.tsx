import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { DatePicker } from "./date-picker.js";

describe("DatePicker", () => {
  it("shows the placeholder until a day is chosen", () => {
    render(<DatePicker value="" onChange={vi.fn()} placeholder="Today" />);
    expect(screen.getByRole("button").textContent).toBe("Today");
  });

  it("shows the raw day by default", () => {
    render(<DatePicker value="2026-11-01" onChange={vi.fn()} />);
    expect(screen.getByRole("button").textContent).toBe("2026-11-01");
  });

  it("reads the chosen day through formatValue when given", () => {
    render(
      <DatePicker
        value="2026-11-01"
        onChange={vi.fn()}
        formatValue={(day) => (day === "2026-11-01" ? "1 Nov 2026" : day)}
      />,
    );
    expect(screen.getByRole("button").textContent).toBe("1 Nov 2026");
  });
});
