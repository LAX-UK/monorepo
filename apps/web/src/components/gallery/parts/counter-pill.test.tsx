import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { CounterPill } from "./counter-pill";

describe("CounterPill", () => {
  it("renders nothing when total <= 1", () => {
    const { container } = render(<CounterPill total={1} index={0} onSelect={vi.fn()} />);
    expect(container).toBeEmptyDOMElement();
  });

  it("renders zero-padded index for many images", () => {
    render(<CounterPill total={40} index={0} onSelect={vi.fn()} liveId="live" />);
    expect(screen.getByText("01 / 40")).toBeInTheDocument();
    expect(screen.getByText("Image 1 of 40")).toBeInTheDocument();
  });

  it("updates visible label when index changes", () => {
    const { rerender } = render(<CounterPill total={12} index={4} onSelect={vi.fn()} />);
    expect(screen.getByText("05 / 12")).toBeInTheDocument();
    rerender(<CounterPill total={12} index={11} onSelect={vi.fn()} />);
    expect(screen.getByText("12 / 12")).toBeInTheDocument();
  });
});
