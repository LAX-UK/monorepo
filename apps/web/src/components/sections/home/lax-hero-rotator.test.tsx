import type { HeroSaleSlideVM } from "@/components/sections/home/home-view-models";
import { LaxHeroSaleroomRotator } from "@/components/sections/home/lax-hero-rotator";
import { HOME_HERO_MIN_H } from "@/lib/marketing/home-hero-layout";
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

vi.mock("next/image", () => ({
  getImageProps: ({ src }: { src: string }) => ({
    props: { src, srcSet: src },
  }),
  default: (props: { alt: string; crossOrigin?: string }) => (
    <img alt={props.alt} data-crossorigin={props.crossOrigin ?? ""} />
  ),
}));

const slideA: HeroSaleSlideVM = {
  id: "sale-a",
  href: "/sales/modern-british-art",
  title: "Modern British Art",
  dateLabel: "12 June 2026",
  coverImageUrl: "https://cdn.example.com/sale-a.jpg",
  coverImageAlt: "Modern British Art cover",
  modeBadge: "Online",
};

const slideB: HeroSaleSlideVM = {
  id: "sale-b",
  href: "/sales/evening-sale",
  title: "Evening Sale",
  dateLabel: "18 June 2026",
  coverImageUrl: "https://cdn.example.com/sale-b.jpg",
  coverImageAlt: "Evening Sale cover",
  modeBadge: "Onsite",
};

describe("LaxHeroSaleroomRotator", () => {
  it("renders hero artwork when coverImageUrl is set", () => {
    render(<LaxHeroSaleroomRotator slides={[slideA]} />);
    expect(screen.getByRole("img", { name: "Modern British Art cover" })).toBeInTheDocument();
  });

  it("exposes a single action from carousel chrome", () => {
    render(<LaxHeroSaleroomRotator slides={[slideA, slideB]} />);
    expect(screen.getAllByRole("link", { name: "View lots" })).toHaveLength(1);
  });

  it("shows previous and next controls, without dots, and copy for the selected slide when multiple slides exist", () => {
    render(<LaxHeroSaleroomRotator slides={[slideA, slideB]} />);

    expect(screen.getByRole("heading", { name: "Modern British Art" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Previous saleroom" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Next saleroom" })).toBeInTheDocument();
    expect(screen.queryByRole("group", { name: "Choose slide" })).toBeNull();
  });

  it("keeps a sized hero shell so absolute media layers do not collapse", () => {
    const { container } = render(<LaxHeroSaleroomRotator slides={[slideA]} />);
    const carousel = container.querySelector('[aria-label="Upcoming salerooms"]');
    expect(carousel).toBeInTheDocument();
    for (const token of HOME_HERO_MIN_H.split(" ")) {
      expect(carousel?.className).toContain(token);
    }
  });

  it("uses fadeUp reveal on slides instead of wipeZoom", () => {
    const { container } = render(<LaxHeroSaleroomRotator slides={[slideA]} />);
    expect(container.querySelector(".reveal--fadeUp")).toBeInTheDocument();
    expect(container.querySelector(".reveal--wipeZoom")).not.toBeInTheDocument();
  });
});
