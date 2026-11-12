import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { UnlinkedOriginalsList } from "./unlinked-originals-list";

const items = [
  { product: "bid", id: "lot-1", title: "Harbour at dusk", artistName: null, state: "Live" },
  {
    product: "lax_art",
    id: "art-1",
    title: "Tidal Margin 4",
    artistName: "Aidan Phelan",
    state: "Published",
  },
] as const;

describe("UnlinkedOriginalsList", () => {
  it("lists live originals from both products, opening a lot and not a lax.art artwork", () => {
    render(<UnlinkedOriginalsList items={items} counts={{ bid: 1, laxArt: 1 }} />);
    expect(screen.getByRole("link", { name: /harbour at dusk/i }).getAttribute("href")).toBe(
      "/admin/lots/lot-1",
    );
    expect(screen.getByText("Tidal Margin 4")).toBeTruthy();
    expect(screen.getByText("Aidan Phelan")).toBeTruthy();
    expect(screen.queryByRole("link", { name: /tidal margin/i })).toBeNull();
    expect(screen.getByText("LAX Bid")).toBeTruthy();
    expect(screen.getByText("lax.art")).toBeTruthy();
  });

  it("says nothing needs linking when every live original has a record", () => {
    render(<UnlinkedOriginalsList items={[]} counts={{ bid: 0, laxArt: 0 }} />);
    expect(screen.getByText("Every live original has a Zoho record")).toBeTruthy();
    expect(screen.queryByRole("list")).toBeNull();
  });

  it("says when the list is cut short", () => {
    render(<UnlinkedOriginalsList items={items} counts={{ bid: 700, laxArt: 300 }} />);
    expect(screen.getByText(/showing the first 2 of 1,000/i)).toBeTruthy();
  });
});
