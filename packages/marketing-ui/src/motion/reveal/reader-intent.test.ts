import { afterEach, describe, expect, it, vi } from "vitest";
import { resetReaderIntentForTests, whenReaderMoves } from "./reader-intent.js";

afterEach(() => {
  resetReaderIntentForTests();
  Object.defineProperty(window, "scrollY", { configurable: true, value: 0 });
});

describe("whenReaderMoves", () => {
  it("waits, and calls back once when the reader first scrolls", () => {
    const callback = vi.fn();
    whenReaderMoves(callback);
    expect(callback).not.toHaveBeenCalled();

    window.dispatchEvent(new Event("scroll"));
    window.dispatchEvent(new Event("scroll"));
    expect(callback).toHaveBeenCalledOnce();
  });

  it.each(["wheel", "touchmove"])("counts a %s as the reader moving", (type) => {
    const callback = vi.fn();
    whenReaderMoves(callback);
    window.dispatchEvent(new Event(type));
    expect(callback).toHaveBeenCalledOnce();
  });

  it("counts a paging key as the reader moving", () => {
    const callback = vi.fn();
    whenReaderMoves(callback);
    window.dispatchEvent(new KeyboardEvent("keydown", { key: "PageDown" }));
    expect(callback).toHaveBeenCalledOnce();
  });

  it("calls back at once when the page opened part-way down", () => {
    Object.defineProperty(window, "scrollY", { configurable: true, value: 600 });
    const callback = vi.fn();
    whenReaderMoves(callback);
    expect(callback).toHaveBeenCalledOnce();
  });

  it("calls back at once for later waiters once the reader has moved", () => {
    whenReaderMoves(() => {});
    window.dispatchEvent(new Event("scroll"));
    const late = vi.fn();
    whenReaderMoves(late);
    expect(late).toHaveBeenCalledOnce();
  });

  it("does not call a cancelled waiter", () => {
    const callback = vi.fn();
    whenReaderMoves(callback)();
    window.dispatchEvent(new Event("scroll"));
    expect(callback).not.toHaveBeenCalled();
  });
});
