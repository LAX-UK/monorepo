import type { SalePressRef } from "../../schema/sales.js";

/** Stable ID for the press hub demo sale (ended, with curated coverage). */
export const PRESS_DEMO_SALE_ID = "e1000006-0000-4000-8000-000000000006";

/** Matches `LEO.laxStockApproved` in legacy demo seed. */
export const PRESS_DEMO_LEGAL_ENTITY_ID = "30000000-0000-4000-9000-000000000001";

const IMG_A = "https://images.unsplash.com/photo-1579783902614-a3fb3927b6a5?w=1200&q=80";
const IMG_B = "https://images.unsplash.com/photo-1541961017774-22349e4a1262?w=1200&q=80";
const IMG_C = "https://images.unsplash.com/photo-1513364776144-60967b0f800f?w=1200&q=80";

/** Curated external press links for `/press` hub and card UI testing. */
export const DEMO_PRESS_COVERAGE: SalePressRef[] = [
  {
    url: "https://www.ft.com/content/lax-contemporary-evening-records",
    headline: "LAX contemporary sale sets new London benchmark",
    outletName: "Financial Times",
    publishedAt: "2026-05-18",
    excerpt:
      "The Mayfair saleroom saw intense bidding across the evening session, with three artist records.",
    mentionType: "feature",
  },
  {
    url: "https://www.theguardian.com/artanddesign/lax-interview-saleroom",
    headline: "Inside LAX: the auction house betting on hybrid salerooms",
    outletName: "The Guardian",
    publishedAt: "2026-04-02",
    excerpt: "We spoke with the team behind the platform's live online and in-room model.",
    mentionType: "interview",
  },
  {
    url: "https://www.bbc.co.uk/news/entertainment-arts-lax-quote",
    headline: "Collectors return to London salerooms after strong online season",
    outletName: "BBC News",
    publishedAt: "2025-11-14",
    excerpt: "LAX reported its strongest quarter for new bidder registrations since 2019.",
    mentionType: "quote",
  },
  {
    url: "https://www.telegraph.co.uk/art/lax-roundup-modern-masters",
    headline: "What sold at London's modern art auctions this week",
    outletName: "The Telegraph",
    publishedAt: "2025-09-22",
    mentionType: "roundup",
  },
  {
    url: "https://www.artnews.com/lax-evening-sale-preview",
    headline: "Five lots to watch at LAX's Spring Contemporary Evening Sale",
    outletName: "ARTnews",
    publishedAt: "2026-03-08",
    excerpt: "Curators highlight painting, sculpture, and works on paper from private collections.",
    mentionType: "feature",
  },
  {
    url: "https://www.standard.co.uk/culture/lax-hybrid-bidding",
    headline: "Hybrid bidding draws younger collectors to Mayfair",
    outletName: "Evening Standard",
    publishedAt: "2024-12-01",
    excerpt: "Online paddle participation rose sharply during the latest hybrid day sale.",
    mentionType: "quote",
  },
  {
    url: "https://www.apollo-magazine.com/lax-market-commentary",
    headline: "London auction week: contemporary market holds firm",
    outletName: "Apollo",
    publishedAt: "2024-06-19",
    mentionType: "roundup",
  },
  {
    url: "https://www.artnet.com/news/lax-platform-interview",
    headline: "How LAX is building a transparent fine art marketplace",
    outletName: "Artnet News",
    publishedAt: "2026-01-15",
    excerpt: "CEO discusses provenance tooling, buyer premiums, and saleroom technology.",
    mentionType: "interview",
  },
];

export const DEMO_AUCTION_DAY_IMAGES = [
  { mediaType: "image" as const, key: IMG_A, caption: "Saleroom during the evening session" },
  { mediaType: "image" as const, key: IMG_B, caption: "Bidders in the Mayfair room" },
  { mediaType: "image" as const, key: IMG_C, caption: "Auctioneer at the rostrum" },
];

export function buildPressDemoSaleRow(now: number, day: number) {
  const endedEnd = new Date(now - 30 * day);
  const endedStart = new Date(now - 60 * day);
  const stamp = new Date(now);

  return {
    id: PRESS_DEMO_SALE_ID,
    title: "Press Archive Demo Sale (Ended)",
    description:
      "Seeded ended sale with curated press coverage for local /press hub testing. Safe to remove in production.",
    coverImages: [IMG_A, IMG_B],
    deliveryMode: "hybrid" as const,
    locationName: "LAX Mayfair Saleroom",
    locationAddress: "12 King Street, St James's, London SW1Y 6QU",
    locationMapUrl: "https://maps.google.com/?q=12+King+Street+London",
    streamUrl: "https://www.youtube.com/watch?v=AtO699gsFS8&t=11s",
    status: "ended" as const,
    startTime: endedStart,
    endTime: endedEnd,
    previewStartTime: new Date(now - 65 * day),
    buyerPremiumRate: "0.25",
    terms: "Demo sale for press hub seed data only.",
    auctionDayImages: DEMO_AUCTION_DAY_IMAGES,
    pressCoverage: DEMO_PRESS_COVERAGE,
    createdByLegalEntityId: PRESS_DEMO_LEGAL_ENTITY_ID,
    createdAt: stamp,
    updatedAt: stamp,
  };
}
