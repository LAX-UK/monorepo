import { FocalKeepEditor } from "@/components/admin/sale-cover/focal-keep-editor";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const onFocalChange = vi.fn();
const onKeepChange = vi.fn();

const draw = (keep?: { x: number; y: number; width: number; height: number }) =>
  render(
    <FocalKeepEditor
      pictureKey="https://cdn.example/a.jpg"
      size={{ width: 4000, height: 3000 }}
      focal={{ x: 0.5, y: 0.5 }}
      keep={keep}
      onFocalChange={onFocalChange}
      onKeepChange={onKeepChange}
      label="default cover picture"
    />,
  );

const surface = () => screen.getByRole("group", { name: /default cover picture/ });

describe("FocalKeepEditor", () => {
  beforeEach(() => {
    onFocalChange.mockReset();
    onKeepChange.mockReset();
    // jsdom has no layout: the picture is 400 × 300 at the page origin.
    vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockReturnValue({
      left: 0,
      top: 0,
      width: 400,
      height: 300,
      right: 400,
      bottom: 300,
      x: 0,
      y: 0,
      toJSON: () => ({}),
    });
    HTMLElement.prototype.setPointerCapture = vi.fn();
    // jsdom has no PointerEvent, so the pointer position would be lost.
    vi.stubGlobal(
      "PointerEvent",
      class extends MouseEvent {
        readonly pointerId: number;
        constructor(type: string, init?: PointerEventInit) {
          super(type, init);
          this.pointerId = init?.pointerId ?? 0;
        }
      },
    );
  });
  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it("sets the focal point where the picture is clicked", () => {
    draw();
    fireEvent.pointerDown(surface(), { clientX: 100, clientY: 150, button: 0, pointerId: 1 });
    fireEvent.pointerUp(surface(), { clientX: 100, clientY: 150, pointerId: 1 });
    expect(onFocalChange).toHaveBeenCalledWith({ x: 0.25, y: 0.5 });
    expect(onKeepChange).not.toHaveBeenCalled();
  });

  it("draws the area to keep when the pointer is dragged", () => {
    draw();
    fireEvent.pointerDown(surface(), { clientX: 40, clientY: 30, button: 0, pointerId: 1 });
    fireEvent.pointerMove(surface(), { clientX: 200, clientY: 150, pointerId: 1 });
    fireEvent.pointerUp(surface(), { clientX: 200, clientY: 150, pointerId: 1 });
    expect(onKeepChange).toHaveBeenCalledWith({ x: 0.1, y: 0.1, width: 0.4, height: 0.4 });
    expect(onFocalChange).not.toHaveBeenCalled();
  });

  it("ignores a drag too small to be a box", () => {
    draw();
    fireEvent.pointerDown(surface(), { clientX: 100, clientY: 100, button: 0, pointerId: 1 });
    fireEvent.pointerMove(surface(), { clientX: 108, clientY: 108, pointerId: 1 });
    fireEvent.pointerUp(surface(), { clientX: 108, clientY: 108, pointerId: 1 });
    expect(onKeepChange).not.toHaveBeenCalled();
  });

  it("keeps the point and the area inside the picture", () => {
    draw();
    fireEvent.pointerDown(surface(), { clientX: 380, clientY: 280, button: 0, pointerId: 1 });
    fireEvent.pointerMove(surface(), { clientX: 900, clientY: 700, pointerId: 1 });
    fireEvent.pointerUp(surface(), { clientX: 900, clientY: 700, pointerId: 1 });
    expect(onKeepChange).toHaveBeenCalledWith({ x: 0.95, y: 0.933, width: 0.05, height: 0.067 });
  });

  it("moves the focal point by 1% with an arrow key and 5% with Shift", () => {
    draw();
    fireEvent.keyDown(surface(), { key: "ArrowRight" });
    expect(onFocalChange).toHaveBeenLastCalledWith({ x: 0.51, y: 0.5 });
    fireEvent.keyDown(surface(), { key: "ArrowUp", shiftKey: true });
    expect(onFocalChange).toHaveBeenLastCalledWith({ x: 0.5, y: 0.45 });
  });

  it("switches the arrow keys to the keep area, resizes with Alt and clears with Delete", () => {
    draw({ x: 0.2, y: 0.2, width: 0.3, height: 0.3 });
    fireEvent.click(screen.getByRole("button", { name: "Move keep area instead" }));
    fireEvent.keyDown(surface(), { key: "ArrowRight" });
    expect(onKeepChange).toHaveBeenLastCalledWith({ x: 0.21, y: 0.2, width: 0.3, height: 0.3 });
    fireEvent.keyDown(surface(), { key: "ArrowDown", altKey: true });
    expect(onKeepChange).toHaveBeenLastCalledWith({ x: 0.2, y: 0.2, width: 0.3, height: 0.31 });
    fireEvent.keyDown(surface(), { key: "Delete" });
    expect(onKeepChange).toHaveBeenLastCalledWith(undefined);
  });

  it("has no controls when it is only a view", () => {
    render(
      <FocalKeepEditor
        pictureKey="https://cdn.example/a.jpg"
        size={{ width: 4000, height: 3000 }}
        focal={{ x: 0.5, y: 0.5 }}
        keep={undefined}
        onFocalChange={onFocalChange}
        onKeepChange={onKeepChange}
        label="default cover picture"
        disabled
      />,
    );
    fireEvent.keyDown(screen.getAllByRole("group")[0] as HTMLElement, { key: "ArrowRight" });
    expect(onFocalChange).not.toHaveBeenCalled();
    expect(
      screen.queryByRole("button", { name: "Move keep area instead" }),
    ).not.toBeInTheDocument();
  });
});
