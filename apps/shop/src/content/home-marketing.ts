import type { ShopStatusPresentation } from "@/lib/presenters/shop-status-presentation";

export type HomeOriginalCard = {
  id: string;
  image: string | null;
  imageAlt: string;
  title: string;
  artistLine: string;
  dimensions: string;
  availabilityNote: string;
  status?: ShopStatusPresentation;
  href: string;
};

export type HomeCategoryCard = {
  id: string;
  image: string | null;
  imageAlt: string;
  label: string;
  href: string;
};

export type HomePrintCard = {
  id: string;
  image: string | null;
  imageAlt: string;
  title: string;
  artist: string;
  medium: string;
  href?: string;
};

export type HomeArtistCard = {
  id: string;
  image: string | null;
  imageAlt: string;
  name: string;
  discipline: string;
  href: string;
};

export type HomeSectionLink = {
  title: string;
  subtitle?: string;
  actionLabel?: string;
  actionHref?: string;
};

export const homeHero = {
  title: "This Week's Arrivals",
  copy: "Discover original works, emerging artists, and distinctive perspectives from around the world through a more considered approach to collecting art.",
  ctaLabel: "Discover",
  ctaHref: "#shop-prints",
  layers: [
    "/shop/home/hero-layer-1.webp",
    "/shop/home/hero-layer-2.webp",
    "/shop/home/hero-layer-3.webp",
  ] as const,
};

export const homeSections = {
  originals: {
    title: "Originals",
    subtitle: "One-of-a-kind works available to enquire",
    actionLabel: "View all",
    actionHref: "/artworks",
  } satisfies HomeSectionLink,
  categories: {
    title: "Shop by Category",
    subtitle: "Collect by medium and discipline",
    actionLabel: "View all",
    actionHref: "/categories",
  } satisfies HomeSectionLink,
  prints: {
    title: "Prints & Multiples",
    subtitle: "Limited editions from the LAX catalogue",
    actionLabel: "View all",
    actionHref: "/artworks?type=edition",
  } satisfies HomeSectionLink,
  artists: {
    title: "Featured Artists",
    subtitle: "Voices shaping contemporary collecting",
    actionLabel: "View all",
    actionHref: "/artists",
  } satisfies HomeSectionLink,
};

export const homeSignup = {
  title: "Discover art worth collecting",
  copy: "Discover exceptional art, follow artists, and find pieces worth collecting, all in one place.",
  ctaLabel: "Sign Up",
  ctaHref: "/register",
  image: "/shop/home/signup-gallery.webp",
  imageAlt: "Gallery wall with contemporary artworks",
};
