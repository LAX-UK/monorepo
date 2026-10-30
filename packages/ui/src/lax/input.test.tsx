import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { TextInput } from "./index.js";

describe("TextInput", () => {
  it("is 36px by default and 44px in the large size", () => {
    const { rerender, container } = render(<TextInput aria-label="Paddle" />);
    expect(container.firstElementChild?.className).toContain("h-lax-control-md");
    rerender(<TextInput aria-label="Paddle" size="lg" />);
    expect(container.firstElementChild?.className).toContain("h-lax-control-lg");
    expect(screen.getByLabelText("Paddle")).toBeInTheDocument();
  });
});
