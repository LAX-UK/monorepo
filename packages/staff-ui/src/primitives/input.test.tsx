import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { TextInput } from "./input.js";

describe("TextInput", () => {
  it("is 36px by default and 44px in the live size", () => {
    const { rerender, container } = render(<TextInput aria-label="Paddle" />);
    expect(container.firstElementChild?.className).toContain("h-control-md");
    rerender(<TextInput aria-label="Paddle" size="live" />);
    expect(container.firstElementChild?.className).toContain("h-11");
    expect(screen.getByLabelText("Paddle")).toBeInTheDocument();
  });
});
