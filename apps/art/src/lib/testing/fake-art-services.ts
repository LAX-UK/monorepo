import type { ArtServices } from "@/lib/art-services.server";
import type { ArtViewerState } from "@/lib/art-viewer-state";
import type {
  PublicArtistSummary,
  PublicArtworkDetail,
  PublicArtworkSummary,
} from "@auction/shop-contracts";
import { vi } from "vitest";

export const GUEST_VIEWER: ArtViewerState = {
  kind: "guest",
  loginHref: "http://localhost:3051/login",
  registerHref: "/register",
};

export const SIGNED_IN_VIEWER: ArtViewerState = {
  kind: "authenticated",
  displayName: "Ada Collector",
  email: "ada@example.com",
  verifiedPhone: "+447700900123",
  emailVerified: true,
  accountHref: "/account",
  logoutHref: "http://localhost:3051/logout",
};

export function artworkSummary(
  overrides: Partial<PublicArtworkSummary> = {},
): PublicArtworkSummary {
  return {
    slug: "warm-basket",
    title: "Warm Basket",
    artistName: "Flora Powers",
    artistSlug: "flora-powers",
    imageUrl: "/warm-basket.webp",
    saleState: "price_on_application",
    dimensions: "40 × 50 cm",
    dimensionsCmDisplay: null,
    yearCreated: 2024,
    medium: "Oil on linen",
    objectType: "painting",
    rarity: "unique",
    salesChannel: "art",
    eligibleForEditionAllocation: false,
    printPricePence: null,
    availability: { totalEditions: 0, editionsAvailable: 0 },
    ...overrides,
  };
}

export function artworkDetail(overrides: Partial<PublicArtworkDetail> = {}): PublicArtworkDetail {
  return {
    ...artworkSummary(),
    description: "Late afternoon light.",
    images: [],
    heightCm: null,
    widthCm: null,
    depthCm: null,
    hasCertificate: false,
    provenance: null,
    exhibitionHistory: null,
    ...overrides,
  };
}

export function artistSummary(overrides: Partial<PublicArtistSummary> = {}): PublicArtistSummary {
  return {
    slug: "flora-powers",
    name: "Flora Powers",
    discipline: "Painter",
    portraitUrl: null,
    artworkCount: 3,
    ...overrides,
  };
}

/** Every port succeeds with empty data; tests override what they exercise. */
export function fakeArtServices(viewer: ArtViewerState = GUEST_VIEWER) {
  return {
    catalogue: {
      listArtworks: vi.fn().mockResolvedValue({ items: [] }),
      getArtwork: vi.fn().mockResolvedValue(null),
      listArtists: vi.fn().mockResolvedValue({ items: [] }),
      getArtist: vi.fn().mockResolvedValue(null),
      listCategories: vi.fn().mockResolvedValue({ items: [] }),
      listArtworkObjectTypes: vi.fn().mockResolvedValue({ items: [] }),
    },
    viewer: { load: vi.fn().mockResolvedValue(viewer) },
    favorites: {
      savedArtworkSlugs: vi.fn().mockResolvedValue(new Set<string>()),
      followedArtistSlugs: vi.fn().mockResolvedValue(new Set<string>()),
      listSavedArtworks: vi.fn().mockResolvedValue({ status: "empty" }),
      listFollowedArtists: vi.fn().mockResolvedValue({ status: "empty" }),
    },
    portal: {
      listEnquiries: vi.fn().mockResolvedValue({ status: "empty" }),
      listGeneralEnquiries: vi.fn().mockResolvedValue({ status: "empty" }),
      listCollection: vi.fn().mockResolvedValue({ status: "empty" }),
      loadPayeeConnect: vi.fn().mockResolvedValue({ status: "failed" }),
    },
    account: {
      laxAccountHref: vi.fn().mockReturnValue("https://account.example.test/account"),
      verifyEmailHref: vi.fn().mockReturnValue("http://localhost:3051/auth/verify-email"),
      payoutsEnabled: vi.fn().mockReturnValue(false),
    },
    editorial: {
      enabled: vi.fn().mockReturnValue(false),
      home: vi.fn().mockResolvedValue({ status: "disabled" }),
      listExhibitions: vi.fn().mockResolvedValue({ status: "disabled" }),
      getExhibition: vi.fn().mockResolvedValue({ status: "disabled" }),
      listStories: vi.fn().mockResolvedValue({ status: "disabled" }),
      getStory: vi.fn().mockResolvedValue({ status: "disabled" }),
      getArtistRelations: vi.fn().mockResolvedValue({ status: "disabled" }),
      listPages: vi.fn().mockResolvedValue({ status: "disabled" }),
      getPage: vi.fn().mockResolvedValue({ status: "disabled" }),
      listVenues: vi.fn().mockResolvedValue({ status: "disabled" }),
      getVenue: vi.fn().mockResolvedValue({ status: "disabled" }),
      preview: vi.fn().mockResolvedValue({ status: "disabled" }),
    },
    editorialSearch: {
      searchExhibitions: vi.fn().mockResolvedValue({ status: "disabled" }),
      searchStories: vi.fn().mockResolvedValue({ status: "disabled" }),
    },
    help: {
      listCategories: vi.fn().mockResolvedValue({ status: "disabled" }),
      listArticles: vi.fn().mockResolvedValue({ status: "disabled" }),
      getArticle: vi.fn().mockResolvedValue({ status: "disabled" }),
    },
    ecosystem: { crossProductLinks: vi.fn().mockReturnValue([]) },
  } satisfies ArtServices;
}
