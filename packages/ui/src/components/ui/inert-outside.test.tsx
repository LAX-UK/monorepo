import { render } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { InertOutside } from "./inert-outside.js";

function region(id: string, attrs: Record<string, string> = {}) {
  const el = document.createElement("div");
  el.id = id;
  for (const [k, v] of Object.entries(attrs)) el.setAttribute(k, v);
  el.innerHTML = `<a href="/home">Home</a>`;
  document.body.append(el);
  return el;
}

const flushMicrotasks = () => Promise.resolve();

describe("InertOutside", () => {
  afterEach(() => {
    for (const el of document.querySelectorAll("body > div[id]")) el.remove();
  });

  it("makes the regions a modal layer hid inert while it is open, and gives them back", async () => {
    const shell = region("shell", { "aria-hidden": "true", "data-aria-hidden": "true" });
    const skip = region("skip", { "aria-hidden": "true", "data-aria-hidden": "true" });
    const { unmount } = render(<InertOutside />);
    await flushMicrotasks();
    expect(shell).toHaveAttribute("inert");
    expect(skip).toHaveAttribute("inert");

    unmount();
    expect(shell).not.toHaveAttribute("inert");
    expect(skip).not.toHaveAttribute("inert");
  });

  it("leaves alone what no layer hid, and an inert it did not set", async () => {
    const visible = region("visible");
    const other = region("other", { "data-aria-hidden": "true", inert: "" });
    const { unmount } = render(<InertOutside />);
    await flushMicrotasks();
    expect(visible).not.toHaveAttribute("inert");
    unmount();
    expect(other).toHaveAttribute("inert");
  });
});
