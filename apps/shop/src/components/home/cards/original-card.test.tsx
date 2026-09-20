/** @vitest-environment jsdom */
import { OriginalCard } from "@/components/home/cards/original-card";
import type { HomeOriginalCard } from "@/content/home-marketing";
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

const card: HomeOriginalCard = {
  id: "original-poa-1",
  image: "/shop/home/artwork-warm-basket.webp",
  imageAlt: "Dark ceramic vessel against an abstract painted background",
  title: "Vessel Study",
  artistLine: "Flora Powers (2014)",
  dimensions: "120 × 90 cm",
  availabilityNote: "Original — one of one",
  status: { label: "Price on request", tone: "accent" },
  href: "/artworks/vessel-study",
};

describe("OriginalCard", () => {
  it("renders a plain-English price status with the real availability note", () => {
    render(<OriginalCard card={card} />);
    expect(screen.getByText("Price on request")).toBeTruthy();
    expect(screen.getByRole("heading", { level: 3, name: card.title })).toBeTruthy();
    expect(screen.getByText("Original — one of one")).toBeTruthy();
    expect(screen.getByRole("link", { name: /Vessel Study/i }).getAttribute("href")).toBe(
      "/artworks/vessel-study",
    );
  });
});
