import { seededStaffRoutes } from "./helpers/auth";

export const visualVariants = {
  "desktop-light": { width: 1440, height: 1000, colorScheme: "light" },
  "desktop-dark": { width: 1440, height: 1000, colorScheme: "dark" },
  "constrained-desktop-light": { width: 1023, height: 900, colorScheme: "light" },
  "constrained-desktop-dark": { width: 1023, height: 900, colorScheme: "dark" },
  "mobile-light": { width: 390, height: 844, colorScheme: "light" },
  "mobile-dark": { width: 390, height: 844, colorScheme: "dark" },
} as const;

export type VisualVariantId = keyof typeof visualVariants;
export type VisualCapture = "page" | "main" | "dialog";
export type VisualSetup = "route" | "client-drawer" | "lot-filters";

type AdminVisualCase = {
  path: string;
  slug: string;
  heading?: RegExp;
  variants: readonly VisualVariantId[];
  capture: VisualCapture;
  setup?: VisualSetup;
};

const allResponsiveVariants = Object.keys(visualVariants) as VisualVariantId[];

export const adminVisualCases: readonly AdminVisualCase[] = [
  {
    path: "/admin",
    slug: "admin-home",
    heading: /good day/i,
    variants: ["desktop-light", "desktop-dark", "mobile-light", "mobile-dark"],
    capture: "page",
  },
  {
    path: "/admin/lots",
    slug: "admin-lots",
    heading: /lots/i,
    variants: ["desktop-light", "mobile-dark"],
    capture: "page",
  },
  {
    path: `/admin/lots/${seededStaffRoutes.lotDetail}`,
    slug: "admin-lot-detail",
    variants: ["desktop-light"],
    capture: "main",
  },
  {
    path: `/admin/clients?client=${seededStaffRoutes.clientDetail}`,
    slug: "admin-clients-drawer",
    variants: ["desktop-light", "mobile-dark"],
    capture: "page",
    setup: "client-drawer",
  },
  {
    path: "/admin/lots",
    slug: "admin-lots-filters-sheet",
    variants: ["constrained-desktop-light"],
    capture: "dialog",
    setup: "lot-filters",
  },
  {
    path: "/admin/categories/new",
    slug: "admin-category-new",
    heading: /new category/i,
    variants: allResponsiveVariants,
    capture: "main",
  },
  {
    path: `/admin/categories/${seededStaffRoutes.categoryDetail}/edit`,
    slug: "admin-category-edit",
    heading: /edit category/i,
    variants: allResponsiveVariants,
    capture: "main",
  },
  {
    path: "/admin/artists/new",
    slug: "admin-artist-new",
    heading: /new artist/i,
    variants: allResponsiveVariants,
    capture: "main",
  },
  {
    path: `/admin/artists/${seededStaffRoutes.artistDetail}/edit`,
    slug: "admin-artist-edit",
    heading: /edit carolina price/i,
    variants: allResponsiveVariants,
    capture: "main",
  },
  {
    path: "/admin/venues/new",
    slug: "admin-venue-new",
    heading: /new venue/i,
    variants: allResponsiveVariants,
    capture: "main",
  },
  {
    path: `/admin/venues/${seededStaffRoutes.venueDetail}/edit`,
    slug: "admin-venue-edit",
    heading: /edit venue/i,
    variants: allResponsiveVariants,
    capture: "main",
  },
] as const;

export const expectedAdminVisualSnapshotNames = adminVisualCases.flatMap((visualCase) =>
  visualCase.variants.map((variant) => `${visualCase.slug}-${variant}.png`),
);
