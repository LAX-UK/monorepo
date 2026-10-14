import { waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { observeScrollLock } from "./scroll-lock.js";

describe("observeScrollLock", () => {
  afterEach(() => {
    document.body.removeAttribute("data-scroll-locked");
    document.body.style.overflow = "";
  });

  it("notifies when data-scroll-locked toggles", async () => {
    const onChange = vi.fn();
    const unsubscribe = observeScrollLock(onChange);
    expect(onChange).toHaveBeenCalledWith(false);
    document.body.setAttribute("data-scroll-locked", "");
    await waitFor(() => expect(onChange).toHaveBeenLastCalledWith(true));
    document.body.removeAttribute("data-scroll-locked");
    await waitFor(() => expect(onChange).toHaveBeenLastCalledWith(false));
    unsubscribe();
  });
});
