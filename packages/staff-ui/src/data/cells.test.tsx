import { render, screen } from "@testing-library/react";
import type * as React from "react";
import { describe, expect, it, vi } from "vitest";

vi.mock("@auction/ui/components/tooltip", () =>
  import("../test/radix-stubs.js").then((m) => m.tooltip),
);

const { PersonCell, PrimaryCell } = await import("./cells.js");

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

describe("PersonCell", () => {
  const Link = ({ href, children, ...rest }: { href: string; children?: React.ReactNode }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  );

  it("shows initials at the 12px step, the name as a link and the email under it", () => {
    const { container } = render(
      <PersonCell
        name="Ada Lovelace"
        secondary="ada@example.com"
        href="/admin/clients/1"
        Link={Link}
      />,
    );
    const avatar = container.querySelector('[data-slot="avatar"]');
    expect(avatar).toHaveTextContent("AL");
    expect(avatar).toHaveClass("text-staff-xs");
    expect(avatar).toHaveAttribute("aria-hidden");
    expect(screen.getByRole("link", { name: "Ada Lovelace" })).toHaveAttribute(
      "href",
      "/admin/clients/1",
    );
    expect(screen.getByText("ada@example.com")).toBeInTheDocument();
  });

  it("never turns the platform into a person called S", () => {
    const { container } = render(<PersonCell name="System" kind="system" />);
    const avatar = container.querySelector('[data-slot="avatar"]');
    expect(avatar).not.toHaveTextContent("S");
    expect(avatar?.querySelector("svg")).not.toBeNull();
    expect(screen.getByText("System")).toBeInTheDocument();
  });
});
