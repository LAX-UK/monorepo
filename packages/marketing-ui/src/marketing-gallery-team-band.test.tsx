import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import {
  MarketingGalleryTeamBand,
  type MarketingGalleryTeamDetail,
} from "./marketing-gallery-team-band.js";

function renderBand(details?: readonly MarketingGalleryTeamDetail[]) {
  return render(
    <MarketingGalleryTeamBand
      eyebrow="The gallery team"
      title="Help choosing a size, a frame or a gift"
      body="Talk to the people who hang these works every day."
      media={<img src="/gallery.webp" alt="" />}
      actions={<a href="tel:+442000000000">020 0000 0000</a>}
      {...(details ? { details } : {})}
    />,
  );
}

describe("MarketingGalleryTeamBand", () => {
  it("is a section named by its title, with the host's ways to get in touch", () => {
    renderBand();
    const section = screen.getByRole("region", { name: "Help choosing a size, a frame or a gift" });
    expect(within(section).getByText("The gallery team")).toBeInTheDocument();
    expect(within(section).getByRole("link", { name: "020 0000 0000" })).toHaveAttribute(
      "href",
      "tel:+442000000000",
    );
  });

  it("lists the address and hours it is given, and nothing when it has none", () => {
    const { unmount } = renderBand([
      { kind: "address", text: "156 New Cavendish Street, London W1W 6YW" },
      { kind: "hours", text: "Tuesday to Saturday" },
    ]);
    const list = screen.getByRole("list");
    expect(list).toHaveTextContent("156 New Cavendish Street");
    expect(list).toHaveTextContent("Tuesday to Saturday");
    unmount();

    renderBand();
    expect(screen.queryByRole("list")).not.toBeInTheDocument();
  });

  it("keeps the gallery photograph decorative", () => {
    renderBand();
    expect(screen.getByRole("presentation")).toHaveAttribute("alt", "");
  });
});
