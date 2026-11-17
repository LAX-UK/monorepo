import { PlainLink } from "@auction/ui/lax";
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { DataViews } from "./toolbar.js";

describe("DataViews counts", () => {
  it("says what a view's count means, and fills the one that waits on the reader in ink", () => {
    render(
      <DataViews
        Link={PlainLink}
        activeId="waiting"
        views={[
          {
            id: "waiting",
            label: "Waiting for a price",
            href: "?view=waiting",
            count: 3,
            countTone: "attention",
            countLabel: "waiting",
          },
          { id: "quoted", label: "Quoted", href: "?view=quoted", count: 2 },
        ]}
      />,
    );
    const views = screen.getByRole("navigation", { name: "Views" });
    const waiting = views.querySelector('a[href="?view=waiting"]') as HTMLElement;
    expect(waiting).toHaveTextContent(/^Waiting for a price\s*3 waiting$/);
    expect(waiting.querySelector(".bg-lax-ink")).toHaveTextContent("3");
    const quoted = views.querySelector('a[href="?view=quoted"]') as HTMLElement;
    expect(quoted).toHaveTextContent(/^Quoted\s*2$/);
    expect(quoted.querySelector(".bg-lax-ink")).toBeNull();
    expect(screen.getAllByText("waiting")[0]).toHaveClass("sr-only");
  });
});
