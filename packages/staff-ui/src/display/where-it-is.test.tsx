import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { WhereItIsChip, type WhereItIsChipSpec, WhereItIsSection } from "./where-it-is.js";

const CHIPS: ReadonlyArray<[WhereItIsChipSpec, string]> = [
  [{ label: "Not offered", tone: "neutral", marker: "hollow" }, "ring"],
  [{ label: "Draft on lax.art", tone: "info", marker: "hollow" }, "ring"],
  [{ label: "On lax.art", tone: "success", marker: "filled" }, "dot"],
  [{ label: "In a LAX Bid sale", tone: "info", marker: "filled" }, "dot"],
  [{ label: "Withdrawn", tone: "warning", marker: "filled" }, "dot"],
  [{ label: "Sold", tone: "neutral", marker: "check" }, "check"],
];

describe("WhereItIsChip", () => {
  it.each(CHIPS)("draws %j with the %s marker", (chip, shape) => {
    const { container } = render(<WhereItIsChip chip={chip} />);
    expect(screen.getByText(chip.label)).toBeInTheDocument();
    expect(container.querySelector(`[data-shape="${shape}"]`)).not.toBeNull();
    expect(container.querySelector("[data-tone]")).toHaveAttribute("data-tone", chip.tone);
  });
});

describe("WhereItIsSection", () => {
  const chip: WhereItIsChipSpec = { label: "On lax.art", tone: "success", marker: "filled" };
  const event = { id: "e1", title: "Published on lax.art", at: "2026-11-02T15:20:00Z" };

  it("is a titled region with the place as a badge and the line in words", () => {
    render(
      <WhereItIsSection chip={chip} lead="Live on lax.art" trail=" since Mon 2 Nov, 15:20 GMT" />,
    );
    const region = screen.getByRole("region", { name: "Where it is" });
    expect(within(region).getByText("On lax.art")).toBeInTheDocument();
    expect(within(region).getByText("Live on lax.art").tagName).toBe("STRONG");
    expect(region).toHaveTextContent("Live on lax.art since Mon 2 Nov, 15:20 GMT");
  });

  it("shows the note, actions, facts and recent moves when given", () => {
    render(
      <WhereItIsSection
        chip={chip}
        lead="Live on lax.art"
        note="Enquiries open."
        actions={<button type="button">Open on lax.art</button>}
        facts={[{ label: "Zoho status", value: "Available" }]}
        moves={{ events: [{ ...event, actor: "Lena Hart" }], historyHref: "/history" }}
      />,
    );
    expect(screen.getByText("Enquiries open.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Open on lax.art" })).toBeInTheDocument();
    expect(screen.getByText("Zoho status")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Recent moves" })).toBeInTheDocument();
    expect(screen.getByRole("list", { name: "Recent moves" })).toHaveTextContent(
      "Published on lax.art",
    );
    expect(screen.getByRole("link", { name: "See full history" })).toHaveAttribute(
      "href",
      "/history",
    );
  });

  it("leaves out what it has nothing for", () => {
    render(<WhereItIsSection chip={chip} lead="Not offered" facts={[]} moves={{ events: [] }} />);
    expect(screen.queryByRole("heading", { name: "Recent moves" })).toBeNull();
    expect(screen.queryByRole("term")).toBeNull();
  });

  it("offers no history link without a target", () => {
    render(<WhereItIsSection chip={chip} lead="x" moves={{ events: [event] }} />);
    expect(screen.queryByRole("link", { name: "See full history" })).toBeNull();
  });

  it("uses the app's Link for the history link", () => {
    render(
      <WhereItIsSection
        chip={chip}
        lead="x"
        moves={{
          events: [event],
          historyHref: "/h",
          Link: ({ href, className, children }) => (
            <a href={href} className={className} data-router="">
              {children}
            </a>
          ),
        }}
      />,
    );
    expect(screen.getByRole("link", { name: "See full history" })).toHaveAttribute("data-router");
  });

  it("can take another title", () => {
    render(<WhereItIsSection chip={chip} lead="x" title="Where this lot is" />);
    expect(screen.getByRole("region", { name: "Where this lot is" })).toBeInTheDocument();
  });

  it("says it is checking, with no badge or actions, while loading", () => {
    render(
      <WhereItIsSection
        chip={chip}
        lead="x"
        loading
        actions={<button type="button">Offer</button>}
      />,
    );
    expect(screen.getByRole("status", { name: "Checking where it is" })).toBeInTheDocument();
    expect(screen.queryByText("On lax.art")).toBeNull();
    expect(screen.queryByRole("button", { name: "Offer" })).toBeNull();
  });
});
