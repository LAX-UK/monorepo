import { useClickOutside } from "@/hooks/use-click-outside";
import { fireEvent, render, screen } from "@testing-library/react";
import { useRef } from "react";
import { describe, expect, it, vi } from "vitest";

function Target({ onOutside }: { onOutside: () => void }) {
  const ref = useRef<HTMLDivElement>(null);
  useClickOutside(true, ref, onOutside);
  return (
    <div>
      <div ref={ref} data-testid="inside">
        Inside
      </div>
      <button type="button">Outside</button>
    </div>
  );
}

describe("useClickOutside", () => {
  it("calls onOutside on pointerdown outside the ref", () => {
    const onOutside = vi.fn();
    render(<Target onOutside={onOutside} />);

    fireEvent.pointerDown(screen.getByRole("button", { name: "Outside" }));
    expect(onOutside).toHaveBeenCalledTimes(1);
  });

  it("does not call onOutside for pointerdown inside the ref", () => {
    const onOutside = vi.fn();
    render(<Target onOutside={onOutside} />);

    fireEvent.pointerDown(screen.getByTestId("inside"));
    expect(onOutside).not.toHaveBeenCalled();
  });
});
