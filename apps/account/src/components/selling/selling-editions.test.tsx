import { buildEditionsPage } from "@/server/domain/selling/selling-editions.vm";
import type { PortalSaleAuthority } from "@auction/shop-contracts";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn() }) }));

const { EditionsPageTitle, SellingEditions } = await import("./selling-editions");

const row = (overrides: Partial<PortalSaleAuthority>): PortalSaleAuthority => ({
  artworkId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
  artworkSlug: "harbor-print",
  artworkTitle: "Harbor Print",
  ownerPartyId: "cccccccc-cccc-4ccc-8ccc-cccccccccccc",
  authorisedCount: 1,
  committedCount: 0,
  lastGrantAt: null,
  ...overrides,
});

const render = (rows: PortalSaleAuthority[]) =>
  renderToStaticMarkup(<SellingEditions page={buildEditionsPage(rows, [])} />);

describe("EditionsPageTitle", () => {
  it("says the editions are sold on LAX Shop, with the name in Shop's colour", () => {
    const html = renderToStaticMarkup(<EditionsPageTitle />);
    expect(html).toContain("Editions you can sell on");
    expect(html).toMatch(/<span[^>]*data-product="shop"[^>]*>LAX Shop<\/span>/);
  });
});

describe("SellingEditions rows", () => {
  it("never says Not approved yet beside an approved count", () => {
    const html = render([row({ authorisedCount: 1, lastGrantAt: null })]);
    expect(html).toContain("Approved to sell");
    expect(html).not.toContain("Not approved yet");
    expect(html).not.toContain("Last approved");
  });

  it("says Not approved yet when nothing is approved", () => {
    const html = render([row({ authorisedCount: 0, committedCount: 0 })]);
    expect(html).toContain("Not approved yet");
  });

  it("puts the edition line after the title of rows whose titles repeat", () => {
    const html = render([
      row({ artworkTitle: "Vessel Study", ownedCount: 24 }),
      row({
        artworkId: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
        artworkTitle: "Vessel Study",
        ownedCount: 3,
      }),
      row({ artworkId: "dddddddd-dddd-4ddd-8ddd-dddddddddddd", ownedCount: 9 }),
    ]);
    expect(html).toContain("Vessel Study<span");
    expect(html).toContain("You hold 24 editions");
    expect(html).toContain("You hold 3 editions");
    expect(html).not.toContain("You hold 9");
  });
});
