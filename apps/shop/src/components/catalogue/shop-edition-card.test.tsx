/** @vitest-environment jsdom */
import { ShopEditionCard } from "@/components/catalogue/shop-edition-card";
import { toEditionCardVm } from "@/lib/catalogue/edition-card.vm";
import { artworkSummary } from "@/test/artwork-summary.fixture";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

const NOW = new Date("2026-10-28T12:00:00.000Z");
const OLDER = { listedAt: "2026-01-01T00:00:00.000Z" };

function renderCard(overrides: Parameters<typeof artworkSummary>[0] = {}, hideArtist = false) {
  return render(
    <ShopEditionCard
      card={toEditionCardVm(artworkSummary(overrides), NOW)}
      hideArtist={hideArtist}
    />,
  );
}

describe("ShopEditionCard", () => {
  afterEach(() => {
    cleanup();
  });

  it("is one link to the edition, named by its title, with the price", () => {
    renderCard(OLDER);
    const links = screen.getAllByRole("link");
    expect(links).toHaveLength(1);
    expect(links[0]?.textContent).toBe("Harbour light");
    expect(links[0]?.getAttribute("href")).toBe("/artworks/harbour-light");
    expect(screen.getByRole("heading", { name: "Harbour light" })).toBeTruthy();
    expect(screen.getByText("Mara Ellison")).toBeTruthy();
    expect(screen.getByText("Giclée print · Edition of 50")).toBeTruthy();
    expect(screen.getByText("£340")).toBeTruthy();
    expect(screen.queryByText("New")).toBeNull();
  });

  it("tags a new release once", () => {
    renderCard();
    expect(screen.getAllByText("New")).toHaveLength(1);
    expect(screen.getByRole("article").getAttribute("data-status")).toBe("new");
  });

  it("shows sold out in place of the price, with a link to the alert", () => {
    renderCard({ availability: { totalEditions: 50, state: "sold_out" } });
    expect(screen.getByText("Sold out")).toBeTruthy();
    expect(screen.queryByText("£340")).toBeNull();
    expect(screen.queryByText("New")).toBeNull();
    const alert = screen.getByRole("link", { name: "Get alerts for Harbour light" });
    expect(alert.getAttribute("href")).toBe("/artworks/harbour-light#edition-alert");
  });

  it("can leave out the artist on the artist's own page", () => {
    renderCard(OLDER, true);
    expect(screen.queryByText("Mara Ellison")).toBeNull();
  });
});
