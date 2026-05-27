import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { MD_MIN_WIDTH_QUERY } from "../../hooks/use-media-query.js";
import { DateTimePicker } from "./date-time-picker.js";

function mockMatchMedia(matches: boolean) {
  vi.stubGlobal(
    "matchMedia",
    vi.fn((query: string) => ({
      matches: query === MD_MIN_WIDTH_QUERY ? matches : false,
      media: query,
      onchange: null,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })),
  );
}

describe("DateTimePicker", () => {
  it("uses popover on desktop and does not mount a bottom sheet portal", () => {
    mockMatchMedia(true);
    const onChange = vi.fn();

    render(<DateTimePicker value="" onChange={onChange} placeholder="Pick date and time" />);

    fireEvent.click(screen.getByRole("button", { name: "Pick date and time" }));

    expect(document.querySelector("[data-vaul-drawer]")).toBeNull();
    expect(screen.getByRole("dialog")).toBeInTheDocument();
  });

  it("uses bottom sheet on mobile", () => {
    mockMatchMedia(false);
    const onChange = vi.fn();

    render(<DateTimePicker value="" onChange={onChange} placeholder="Pick date and time" />);

    fireEvent.click(screen.getByRole("button", { name: "Pick date and time" }));

    expect(document.querySelector("[data-vaul-drawer]")).not.toBeNull();
  });
});
