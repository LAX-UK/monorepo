import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { Button } from "./button.js";

describe("Button underline variant", () => {
  it("renders an underlined text action that keeps the 44px tap target", () => {
    render(<Button variant="underline">Enquire</Button>);
    const button = screen.getByRole("button", { name: "Enquire" });
    expect(button.className).toContain("underline");
    expect(button.className).toContain("min-h-[var(--tap-target-min,44px)]");
    expect(button.className).toContain("px-0");
    expect(button.className).not.toContain("px-6");
  });

  it("ignores block sizes so the text stays flush with surrounding copy", () => {
    render(
      <Button variant="underline" size="lg">
        Enquire
      </Button>,
    );
    expect(screen.getByRole("button", { name: "Enquire" }).className).not.toContain("px-8");
  });
});
