import { EmptyStateIllustration } from "@/components/illustrations/empty-state-illustrations";
import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";

describe("EmptyStateIllustration", () => {
  it("renders decorative svg as aria-hidden", () => {
    const { container } = render(<EmptyStateIllustration name="notFound" />);
    const svg = container.querySelector("svg");
    expect(svg).toBeTruthy();
    expect(svg).toHaveAttribute("aria-hidden");
  });
});
