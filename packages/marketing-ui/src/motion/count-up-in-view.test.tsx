import { render, screen, waitFor } from "@testing-library/react";
import { renderToString } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { CountUpInView } from "./count-up-in-view.js";

vi.mock("@auction/ui", () => ({
  CountUp: ({
    value,
    format,
  }: {
    value: number;
    format?: (n: number) => string;
  }) => <span>{format ? format(value) : String(value)}</span>,
}));

vi.mock("./reveal/triggers.js", () => ({
  inViewTrigger: () => ({
    bind: (_el: Element, onReveal: () => void) => {
      queueMicrotask(onReveal);
      return () => {};
    },
  }),
}));

describe("CountUpInView", () => {
  it("server render shows the final value", () => {
    const html = renderToString(<CountUpInView value={200} format={(n) => String(n)} />);
    expect(html).toContain("200");
  });

  it("animates after the in-view trigger fires", async () => {
    render(<CountUpInView value={200} format={(n) => String(n)} />);
    await waitFor(() => {
      expect(screen.getByText("200")).toBeTruthy();
    });
  });

  it("skips animation when reduced motion is preferred", async () => {
    vi.spyOn(window, "matchMedia").mockImplementation(
      (query) =>
        ({
          matches: query.includes("reduce"),
          addEventListener: vi.fn(),
          removeEventListener: vi.fn(),
        }) as unknown as MediaQueryList,
    );
    render(<CountUpInView value={42} format={(n) => String(n)} />);
    await waitFor(() => {
      expect(screen.getByText("42")).toBeTruthy();
    });
  });
});
