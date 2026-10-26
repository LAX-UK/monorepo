import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { HoldButton } from "./hold-button.js";

describe("HoldButton", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  const setup = () => {
    const done = vi.fn();
    render(
      <HoldButton onHoldComplete={done} holdMs={600}>
        Hold to hammer
      </HoldButton>,
    );
    return { done, button: screen.getByRole("button", { name: "Hold to hammer" }) };
  };

  it("explains the hold to assistive technology", () => {
    const { button } = setup();
    expect(button).toHaveAccessibleDescription(
      "Press and hold to confirm. Release early to cancel.",
    );
  });

  it("does nothing when released early or clicked", () => {
    const { done, button } = setup();
    fireEvent.pointerDown(button, { button: 0 });
    act(() => vi.advanceTimersByTime(400));
    fireEvent.pointerUp(button);
    act(() => vi.advanceTimersByTime(1000));
    fireEvent.click(button);
    expect(done).not.toHaveBeenCalled();
  });

  it("runs once when the hold completes, and holding on does not repeat it", () => {
    const { done, button } = setup();
    fireEvent.pointerDown(button, { button: 0 });
    act(() => vi.advanceTimersByTime(600));
    expect(done).toHaveBeenCalledTimes(1);
    act(() => vi.advanceTimersByTime(3000));
    expect(done).toHaveBeenCalledTimes(1);
    fireEvent.pointerUp(button);
    expect(done).toHaveBeenCalledTimes(1);
  });

  it("works by holding Space or Enter, ignoring key repeat", () => {
    const { done, button } = setup();
    fireEvent.keyDown(button, { key: "Enter" });
    act(() => vi.advanceTimersByTime(300));
    fireEvent.keyDown(button, { key: "Enter", repeat: true });
    act(() => vi.advanceTimersByTime(300));
    expect(done).toHaveBeenCalledTimes(1);
    fireEvent.keyUp(button, { key: "Enter" });

    fireEvent.keyDown(button, { key: " " });
    act(() => vi.advanceTimersByTime(200));
    fireEvent.keyUp(button, { key: " " });
    act(() => vi.advanceTimersByTime(1000));
    expect(done).toHaveBeenCalledTimes(1);
  });

  it("does not start while disabled", () => {
    const done = vi.fn();
    render(
      <HoldButton onHoldComplete={done} disabled>
        Hold to pass
      </HoldButton>,
    );
    const button = screen.getByRole("button", { name: "Hold to pass" });
    fireEvent.pointerDown(button, { button: 0 });
    fireEvent.keyDown(button, { key: "Enter" });
    act(() => vi.advanceTimersByTime(1000));
    expect(done).not.toHaveBeenCalled();
  });
});
