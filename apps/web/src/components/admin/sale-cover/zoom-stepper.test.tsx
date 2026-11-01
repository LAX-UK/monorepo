import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { useState } from "react";
import { afterEach, describe, expect, it } from "vitest";
import { ZoomStepper } from "./zoom-stepper";

function Harness({ start = 1.5, disabled = false }: { start?: number; disabled?: boolean }) {
  const [value, setValue] = useState(start);
  return (
    <>
      <ZoomStepper value={value} min={1} max={2.5} disabled={disabled} onChange={setValue} />
      <output data-testid="value">{value}</output>
    </>
  );
}

const value = () => Number(screen.getByTestId("value").textContent);

describe("ZoomStepper", () => {
  afterEach(cleanup);

  it("steps in with the buttons, 0.05 at a time", () => {
    render(<Harness />);
    fireEvent.click(screen.getByRole("button", { name: "Zoom in" }));
    expect(value()).toBe(1.55);
    fireEvent.click(screen.getByRole("button", { name: "Zoom out" }));
    fireEvent.click(screen.getByRole("button", { name: "Zoom out" }));
    expect(value()).toBe(1.45);
  });

  it("moves with the arrow keys, further with Shift", () => {
    render(<Harness />);
    const field = screen.getByRole("textbox", { name: "Zoom" });
    fireEvent.keyDown(field, { key: "ArrowUp" });
    expect(value()).toBe(1.55);
    fireEvent.keyDown(field, { key: "ArrowDown", shiftKey: true });
    expect(value()).toBe(1.3);
  });

  it("takes a typed value, and holds one outside the range to it when the field is left", () => {
    render(<Harness />);
    const field = screen.getByRole("textbox", { name: "Zoom" });
    fireEvent.change(field, { target: { value: "2,1" } });
    expect(value()).toBe(2.1);
    fireEvent.change(field, { target: { value: "9" } });
    expect(value()).toBe(2.1);
    fireEvent.blur(field);
    expect(value()).toBe(2.5);
    expect(field).toHaveValue("2.50");
  });

  it("puts back the last good value when the text is not a number", () => {
    render(<Harness />);
    const field = screen.getByRole("textbox", { name: "Zoom" });
    fireEvent.change(field, { target: { value: "abc" } });
    fireEvent.blur(field);
    expect(field).toHaveValue("1.50");
    expect(value()).toBe(1.5);
  });

  it("stops at the ends of the range", () => {
    render(<Harness start={2.5} />);
    expect(screen.getByRole("button", { name: "Zoom in" })).toBeDisabled();
    cleanup();
    render(<Harness start={1} />);
    expect(screen.getByRole("button", { name: "Zoom out" })).toBeDisabled();
  });

  it("cannot be changed when disabled", () => {
    render(<Harness disabled />);
    expect(screen.getByRole("textbox", { name: "Zoom" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Zoom in" })).toBeDisabled();
  });
});
