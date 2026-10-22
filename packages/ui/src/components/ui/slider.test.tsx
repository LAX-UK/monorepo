import { render, screen } from "@testing-library/react";
import { beforeAll, describe, expect, it } from "vitest";
import { Slider } from "./slider.js";

beforeAll(() => {
  globalThis.ResizeObserver ??= class {
    observe() {}
    unobserve() {}
    disconnect() {}
  };
});

describe("Slider", () => {
  it("names its thumb when a label is given", () => {
    render(<Slider defaultValue={[10]} thumbLabel="Seek" />);
    expect(screen.getByRole("slider", { name: "Seek" })).toHaveAttribute("aria-valuenow", "10");
  });
});
