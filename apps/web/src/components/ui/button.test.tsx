import { Button } from "@auction/ui/components/button";
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

describe("Button", () => {
  it("applies primary variant padding, rounding, and tap target", () => {
    render(<Button variant="primary">New submission</Button>);
    const el = screen.getByRole("button", { name: /new submission/i });
    expect(el.className).toMatch(/rounded-md/);
    expect(el.className).toMatch(/px-6/);
    expect(el.className).toMatch(/min-h-11/);
    expect(el.className).not.toMatch(/rounded-none/);
    expect(el.className).not.toMatch(/px-\[inherit\]/);
  });

  it("includes gap-2 for icon and label spacing", () => {
    render(
      <Button variant="primary">
        <span data-testid="icon" />
        Label
      </Button>,
    );
    expect(screen.getByRole("button").className).toMatch(/gap-2/);
  });

  it("merges className onto asChild output", () => {
    render(
      <Button variant="secondaryOutline" asChild className="w-full">
        <a href="/dashboard/submissions/new">New submission</a>
      </Button>,
    );
    const link = screen.getByRole("link", { name: /new submission/i });
    expect(link.className).toMatch(/w-full/);
    expect(link.className).toMatch(/min-h-11/);
    expect(link.className).toMatch(/rounded-md/);
  });

  it("uses lg size when specified", () => {
    render(
      <Button variant="primary" size="lg">
        Large CTA
      </Button>,
    );
    expect(screen.getByRole("button", { name: /large cta/i }).className).toMatch(/min-h-12/);
  });

  it("skips block size min-height for link-shaped variants", () => {
    render(<Button variant="tertiary">Cancel</Button>);
    const el = screen.getByRole("button", { name: /cancel/i });
    expect(el.className).not.toMatch(/min-h-11/);
    expect(el.className).toMatch(/border-b/);
  });
});
