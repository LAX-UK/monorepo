import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { Progress } from "./progress.js";

describe("Progress", () => {
  it("exposes its value to assistive technology", () => {
    render(<Progress value={40} aria-label="Reading progress" />);
    const bar = screen.getByRole("progressbar", { name: "Reading progress" });
    expect(bar).toHaveAttribute("aria-valuenow", "40");
    expect(bar.firstElementChild).toHaveStyle({ transform: "translateX(-60%)" });
  });
});
