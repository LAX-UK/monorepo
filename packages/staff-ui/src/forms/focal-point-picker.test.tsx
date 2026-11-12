import { Field } from "@auction/ui/lax";
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { FocalPointPicker } from "./focal-point-picker.js";
import { describeFocal, focalFromKey, focalFromPointer } from "./focal-point.js";

describe("focalFromPointer", () => {
  const box = { left: 100, top: 50, width: 400, height: 200 };

  it("gives the point in the picture's own units", () => {
    expect(focalFromPointer({ clientX: 300, clientY: 100 }, box)).toEqual({ x: 0.5, y: 0.25 });
  });

  it("keeps a pointer outside the picture on its edge", () => {
    expect(focalFromPointer({ clientX: 0, clientY: 900 }, box)).toEqual({ x: 0, y: 1 });
  });

  it("centres when the box has no size yet", () => {
    expect(focalFromPointer({ clientX: 10, clientY: 10 }, { ...box, width: 0 })).toEqual({
      x: 0.5,
      y: 0.5,
    });
  });
});

describe("focalFromKey", () => {
  const at = { x: 0.5, y: 0.5 };

  it("nudges by a hundredth, or a twentieth with Shift", () => {
    expect(focalFromKey(at, "ArrowRight", false)).toEqual({ x: 0.51, y: 0.5 });
    expect(focalFromKey(at, "ArrowUp", true)).toEqual({ x: 0.5, y: 0.45 });
  });

  it("stops at the edges", () => {
    expect(focalFromKey({ x: 1, y: 0 }, "ArrowRight", false)).toEqual({ x: 1, y: 0 });
    expect(focalFromKey({ x: 0, y: 0 }, "ArrowUp", false)).toEqual({ x: 0, y: 0 });
  });

  it("centres on Home and ignores other keys", () => {
    expect(focalFromKey({ x: 0.1, y: 0.9 }, "Home", false)).toEqual({ x: 0.5, y: 0.5 });
    expect(focalFromKey(at, "a", false)).toBeNull();
  });
});

describe("describeFocal", () => {
  it("says it in whole percentages", () => {
    expect(describeFocal({ x: 0.704, y: 0.396 })).toBe("70% across, 40% down");
  });
});

/** jsdom has no PointerEvent; a mouse event named as a pointer press carries the same fields. */
const press = (target: Element, clientX: number, clientY: number) =>
  fireEvent(target, new MouseEvent("pointerdown", { bubbles: true, clientX, clientY, button: 0 }));

describe("FocalPointPicker", () => {
  const setup = (over: Partial<Parameters<typeof FocalPointPicker>[0]> = {}) => {
    const onValueChange = vi.fn();
    render(
      <FocalPointPicker
        src="/p.jpg"
        ratio={2}
        value={{ x: 0.5, y: 0.5 }}
        onValueChange={onValueChange}
        label="Where the subject is"
        {...over}
      />,
    );
    return { onValueChange, surface: screen.getByRole("application") };
  };

  it("is named, and describes where the point is and how to move it", () => {
    const { surface } = setup();
    expect(surface).toHaveAccessibleName("Where the subject is");
    expect(surface).toHaveAccessibleDescription(/50% across, 50% down\. Use the arrow keys/);
  });

  it("moves with the arrow keys", () => {
    const { surface, onValueChange } = setup();
    fireEvent.keyDown(surface, { key: "ArrowLeft", shiftKey: true });
    expect(onValueChange).toHaveBeenCalledWith({ x: 0.45, y: 0.5 });
  });

  it("does not react to keys other than the arrows and Home", () => {
    const { surface, onValueChange } = setup();
    fireEvent.keyDown(surface, { key: "Enter" });
    expect(onValueChange).not.toHaveBeenCalled();
  });

  it("sets the point where it is pressed", () => {
    const { surface, onValueChange } = setup();
    surface.getBoundingClientRect = () =>
      ({ left: 0, top: 0, width: 200, height: 100, right: 200, bottom: 100 }) as DOMRect;
    surface.setPointerCapture = vi.fn();
    press(surface, 150, 25);
    expect(onValueChange).toHaveBeenCalledWith({ x: 0.75, y: 0.25 });
  });

  it("takes the id, description and error of the Field around it", () => {
    render(
      <Field label="Picture" id="cover-picture" description="Click the subject." error="Too small">
        <FocalPointPicker
          src="/p.jpg"
          value={{ x: 0.5, y: 0.5 }}
          onValueChange={() => {}}
          label="Where the subject is"
        />
      </Field>,
    );
    const surface = screen.getByRole("application");
    expect(surface).toHaveAttribute("id", "cover-picture");
    expect(surface).toHaveAccessibleDescription(/Click the subject\..*Too small.*50% across/);
  });

  it("reports the picture's own size once it has loaded", () => {
    const onImageSize = vi.fn();
    const { container } = render(
      <FocalPointPicker
        src="/p.jpg"
        value={{ x: 0.5, y: 0.5 }}
        onValueChange={() => {}}
        label="Where"
        onImageSize={onImageSize}
      />,
    );
    const image = container.querySelector("img") as HTMLImageElement;
    Object.defineProperty(image, "naturalWidth", { value: 3200 });
    Object.defineProperty(image, "naturalHeight", { value: 1600 });
    fireEvent.load(image);
    expect(onImageSize).toHaveBeenCalledWith({ width: 3200, height: 1600 });
  });

  it("ignores everything when disabled, and leaves the tab order", () => {
    const { surface, onValueChange } = setup({ disabled: true });
    fireEvent.keyDown(surface, { key: "ArrowRight" });
    press(surface, 5, 5);
    expect(onValueChange).not.toHaveBeenCalled();
    expect(surface).toHaveAttribute("tabindex", "-1");
    expect(surface).toHaveAttribute("aria-disabled", "true");
  });
});
