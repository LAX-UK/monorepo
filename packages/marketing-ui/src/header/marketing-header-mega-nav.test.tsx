import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import {
  MarketingHeaderMegaNav,
  type MarketingMegaNavSection,
} from "./marketing-header-mega-nav.js";

const SECTIONS: MarketingMegaNavSection[] = [
  {
    id: "artists",
    label: "Artists",
    viewAllHref: "/artists",
    viewAllLabel: "View all artists",
    items: [
      {
        href: "/artists/frida",
        label: "Frida Kahlo",
        media: { src: "https://cdn.example/frida.jpg", alt: "Portrait of Frida", caption: "Frida" },
      },
      {
        href: "/artists/pablo",
        label: "Pablo Picasso",
        media: { src: "https://cdn.example/pablo.jpg", alt: "Portrait of Pablo", caption: "Pablo" },
      },
    ],
  },
  {
    id: "artworks",
    label: "Artworks",
    items: [],
    columns: [
      {
        id: "type",
        title: "Type",
        items: [{ href: "/artworks?type=original", label: "Originals" }],
      },
      { id: "medium", title: "Medium", items: [{ href: "/paintings", label: "Paintings" }] },
    ],
  },
  { id: "hub", label: "Art Hub", items: [], linkHref: "/art-hub" },
];

function renderNav(activeId?: string) {
  render(
    <MarketingHeaderMegaNav
      sections={SECTIONS}
      isSectionActive={(section) => section.id === activeId}
      resetKey="/"
      logo={<span>Logo</span>}
      trailing={null}
    />,
  );
  return screen.getByRole("navigation", { name: "Primary" });
}

function panel() {
  return document.getElementById("site-header-megamenu") as HTMLElement;
}

describe("MarketingHeaderMegaNav", () => {
  it("renders link-only sections as plain links with no panel trigger", () => {
    const nav = renderNav("hub");
    const hub = within(nav).getByRole("link", { name: "Art Hub" });
    expect(hub).toHaveAttribute("href", "/art-hub");
    expect(hub).toHaveAttribute("aria-current", "page");
    expect(within(nav).queryByRole("button", { name: "Art Hub" })).toBeNull();
  });

  it("shows the first item's featured media and follows the focused item", () => {
    const nav = renderNav();
    fireEvent.click(within(nav).getByRole("button", { name: "Artists" }));
    const shelf = within(panel());
    expect(shelf.getByText("Frida", { selector: "figcaption" })).toBeInTheDocument();

    fireEvent.focus(shelf.getByRole("link", { name: "Pablo Picasso" }));
    expect(shelf.getByText("Pablo", { selector: "figcaption" })).toBeInTheDocument();
    expect(shelf.getByRole("link", { name: "View all artists" })).toHaveAttribute(
      "href",
      "/artists",
    );
  });

  it("renders titled columns and opens them from the keyboard", async () => {
    const nav = renderNav();
    const trigger = within(nav).getByRole("button", { name: "Artworks" });
    fireEvent.keyDown(trigger, { key: "ArrowDown" });
    expect(trigger).toHaveAttribute("aria-expanded", "true");
    const shelf = within(panel());
    expect(shelf.getAllByRole("heading", { level: 3 }).map((h) => h.textContent)).toEqual([
      "Type",
      "Medium",
    ]);
    const originals = shelf.getByRole("link", { name: "Originals" });
    await new Promise((resolve) => queueMicrotask(() => resolve(null)));
    expect(originals).toHaveFocus();

    fireEvent.keyDown(originals, { key: "ArrowDown" });
    expect(shelf.getByRole("link", { name: "Paintings" })).toHaveFocus();

    fireEvent.keyDown(document, { key: "Escape" });
    expect(trigger).toHaveAttribute("aria-expanded", "false");
    expect(trigger).toHaveFocus();
  });
});
