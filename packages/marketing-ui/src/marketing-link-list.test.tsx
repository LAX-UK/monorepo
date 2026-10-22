import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { MarketingLinkList } from "./marketing-link-list.js";

describe("MarketingLinkList", () => {
  it("renders each item as a link inside a labelled navigation landmark", () => {
    render(
      <MarketingLinkList
        ariaLabel="Explore the hub"
        items={[
          { label: "Explore artists", href: "/artists" },
          { label: "Stories", href: "/stories" },
        ]}
      />,
    );
    const nav = screen.getByRole("navigation", { name: "Explore the hub" });
    const links = within(nav).getAllByRole("link");
    expect(links.map((link) => link.getAttribute("href"))).toEqual(["/artists", "/stories"]);
    expect(links[0]).toHaveTextContent("Explore artists");
  });
});
