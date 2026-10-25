import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

vi.mock("@auction/ui/components/tooltip", () =>
  import("../test/radix-stubs.js").then((m) => m.tooltip),
);

const { PrimaryCell } = await import("./cells.js");

describe("PrimaryCell", () => {
  it("puts the record's picture before its link and second line", () => {
    const { container } = render(
      <PrimaryCell href="/admin/lots/1" thumbnail={{ src: "/lot.jpg" }} secondary="Lot 12">
        Blue Interior
      </PrimaryCell>,
    );
    expect(screen.getByRole("link", { name: "Blue Interior" })).toHaveAttribute(
      "href",
      "/admin/lots/1",
    );
    expect(screen.getByText("Lot 12")).toBeInTheDocument();
    const img = container.querySelector("img");
    expect(img).toHaveAttribute("src", "/lot.jpg");
    // Decorative: the link already names the record.
    expect(img).toHaveAttribute("alt", "");
  });

  it("shows a named placeholder when the record has no picture yet", () => {
    render(
      <PrimaryCell thumbnail={{ src: null, missingLabel: "No photos yet" }}>
        Blue Interior
      </PrimaryCell>,
    );
    expect(screen.getByRole("img", { name: "No photos yet" })).toBeInTheDocument();
  });
});
