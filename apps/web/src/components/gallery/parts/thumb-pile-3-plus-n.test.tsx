import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { ThumbPile3PlusN } from "./thumb-pile-3-plus-n";

describe("ThumbPile3PlusN", () => {
  it("renders one control per image when total <= 3", () => {
    const onSelect = vi.fn();
    render(<ThumbPile3PlusN total={3} index={0} onSelect={onSelect} />);
    expect(screen.getAllByRole("button")).toHaveLength(3);
    expect(screen.queryByText(/^\+/)).not.toBeInTheDocument();
  });

  it("renders 3 dots and +N overflow when total > 3", () => {
    const onOverflow = vi.fn();
    render(<ThumbPile3PlusN total={5} index={2} onSelect={vi.fn()} onOverflow={onOverflow} />);
    expect(screen.getByText("+2")).toBeInTheDocument();
    expect(screen.getAllByRole("button")).toHaveLength(4);
  });

  it("invokes onOverflow when +N is clicked", () => {
    const onOverflow = vi.fn();
    render(<ThumbPile3PlusN total={5} index={0} onSelect={vi.fn()} onOverflow={onOverflow} />);
    fireEvent.click(screen.getByText("+2"));
    expect(onOverflow).toHaveBeenCalledOnce();
  });

  it("invokes onSelect when a dot is clicked", () => {
    const onSelect = vi.fn();
    render(<ThumbPile3PlusN total={5} index={1} onSelect={onSelect} onOverflow={vi.fn()} />);
    fireEvent.click(screen.getByLabelText("Show image 1 of 5"));
    expect(onSelect).toHaveBeenCalledWith(0);
  });
});
