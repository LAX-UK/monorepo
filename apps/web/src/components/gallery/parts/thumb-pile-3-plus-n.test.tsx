import { fireEvent, render, screen } from "@testing-library/react";
import type { ComponentProps } from "react";
import { describe, expect, it, vi } from "vitest";
import { ThumbPile3PlusN } from "./thumb-pile-3-plus-n";

vi.mock("next/image", () => ({
  default: (props: ComponentProps<"img">) => (
    // biome-ignore lint/a11y/useAltText: mock passes alt from component under test
    <img {...props} />
  ),
}));

vi.mock("@/components/ui/media-image", () => ({
  MediaImage: ({ src }: { src: string }) => <span data-testid="thumb">{src}</span>,
}));

const images = Array.from({ length: 5 }, (_, i) => ({ src: `/img-${i}.jpg` }));

describe("ThumbPile3PlusN", () => {
  it("renders one control per image when total <= 3", () => {
    const onSelect = vi.fn();
    render(<ThumbPile3PlusN images={images.slice(0, 3)} total={3} index={0} onSelect={onSelect} />);
    expect(screen.getAllByRole("button")).toHaveLength(3);
    expect(screen.queryByText(/^\+/)).not.toBeInTheDocument();
  });

  it("renders 3 thumbs and +N overflow when total > 3", () => {
    const onOverflow = vi.fn();
    render(
      <ThumbPile3PlusN
        images={images}
        total={5}
        index={2}
        onSelect={vi.fn()}
        onOverflow={onOverflow}
      />,
    );
    expect(screen.getByText("+2")).toBeInTheDocument();
    expect(screen.getAllByTestId("thumb")).toHaveLength(3);
  });

  it("invokes onOverflow when +N is clicked", () => {
    const onOverflow = vi.fn();
    render(
      <ThumbPile3PlusN
        images={images}
        total={5}
        index={0}
        onSelect={vi.fn()}
        onOverflow={onOverflow}
      />,
    );
    fireEvent.click(screen.getByText("+2"));
    expect(onOverflow).toHaveBeenCalledOnce();
  });

  it("invokes onSelect when a thumb is clicked", () => {
    const onSelect = vi.fn();
    render(
      <ThumbPile3PlusN
        images={images}
        total={5}
        index={1}
        onSelect={onSelect}
        onOverflow={vi.fn()}
      />,
    );
    fireEvent.click(screen.getByLabelText("Show image 1 of 5"));
    expect(onSelect).toHaveBeenCalledWith(0);
  });
});
