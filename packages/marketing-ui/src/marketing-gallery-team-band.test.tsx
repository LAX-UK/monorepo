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

  it("names each detail and links the ones it is given a target for", () => {
    renderBand([
      { kind: "phone", text: "+44 800 208 4800", href: "tel:+448002084800" },
      { kind: "email", text: "info@lax.art", href: "mailto:info@lax.art" },
      {
        kind: "address",
        text: "156 New Cavendish Street, London W1W 6YW",
        href: "https://www.google.com/maps/search/?api=1&query=156",
      },
    ]);
    const phone = screen.getByRole("link", { name: "+44 800 208 4800" });
    expect(phone).toHaveAttribute("href", "tel:+448002084800");
    expect(phone).not.toHaveAttribute("target");
    expect(screen.getByRole("link", { name: "info@lax.art" })).toHaveAttribute(
      "href",
      "mailto:info@lax.art",
    );
    const map = screen.getByRole("link", { name: /156 New Cavendish Street.*opens in a new tab/ });
    expect(map).toHaveAttribute("target", "_blank");
    expect(map).toHaveAttribute("rel", "noopener noreferrer");
    expect(screen.getByRole("list")).toHaveTextContent("Phone:");
    expect(screen.getByRole("list")).toHaveTextContent("Address:");
  });

  it("shows the promise under the actions only when it is given one", () => {
    const { unmount } = render(
      <MarketingGalleryTeamBand
        eyebrow="The gallery team"
        title="Speak to the gallery team"
        body="We will help you find the work."
        media={<img src="/gallery.webp" alt="" />}
        actions={<button type="button">Begin a private enquiry</button>}
        note="The gallery team replies within one working day."
      />,
    );
    expect(screen.getByText("The gallery team replies within one working day.")).toBeVisible();
    unmount();

    renderBand();
    expect(screen.queryByText(/replies within/)).not.toBeInTheDocument();
  });
});
