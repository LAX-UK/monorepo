import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { MarketingCatalogList, MarketingCatalogListRow } from "./marketing-catalog-list.js";

function renderRow(props: Partial<Parameters<typeof MarketingCatalogListRow>[0]> = {}) {
  return render(
    <MarketingCatalogList aria-label="Works">
      <MarketingCatalogListRow
        href="/artworks/a"
        linkLabel="Vessel by Amara"
        image={<span data-testid="thumb" />}
        title="Vessel"
        subtitle="Amara"
        data-testid="row"
        {...props}
      />
    </MarketingCatalogList>,
  );
}

describe("MarketingCatalogListRow", () => {
  it("keeps Bid's square thumb by default", () => {
    renderRow();
    const row = screen.getByTestId("row");
    expect(row).toHaveAttribute("data-size", "md");
    expect(screen.getByTestId("thumb").parentElement?.className).toContain("sm:size-24");
    expect(screen.getByRole("link", { name: "Vessel by Amara" })).toHaveAttribute(
      "href",
      "/artworks/a",
    );
    expect(screen.queryByTestId("marketing-catalog-list-row-aside")).toBeNull();
  });

  it("renders large landscape media and a divided aside column", () => {
    renderRow({
      size: "lg",
      aside: <button type="button">Enquire</button>,
    });
    expect(screen.getByTestId("row")).toHaveAttribute("data-size", "lg");
    const media = screen.getByTestId("thumb").parentElement?.className ?? "";
    expect(media).toContain("md:aspect-[4/3]");
    expect(media).toContain("lg:w-[16.25rem]");
    const aside = screen.getByTestId("marketing-catalog-list-row-aside");
    expect(aside.className).toContain("md:border-l");
    expect(aside).toContainElement(screen.getByRole("button", { name: "Enquire" }));
  });
});
