/**
 * View-models for the saleroom page (ISP).
 * These types are intentionally small and opinionated toward rendering; mappers in
 * `mappers.ts` are the only place raw `Sale` / `Lot` types are read (DIP).
 */

export type SaleHeroVM = {
  id: string;
  title: string;
  coverImage: string | null;
  startEndLabel: string;
  status: "draft" | "scheduled" | "active" | "ended" | "cancelled";
  isLive: boolean;
  registrationClosesLabel: string | null;
  biddingStartsLabel: string | null;
  description: string | null;
  shareUrl: string;
  itemsLabel: string;
  tags: string[];
};

export type SaleLotCardVM = {
  id: string;
  href: string;
  lotLabel: string | null;
  title: string;
  imageUrl: string | null;
  imageAlt: string;
  estimateLabel: string | null;
  currentBidLabel: string;
  currentBidValue: string;
  closingLabel: string | null;
  isLive: boolean;
  viewerOwnsLot: boolean;
};

export type RelatedSaleVM = {
  id: string;
  href: string;
  title: string;
  kindLabel: string;
  dateLabel: string;
  itemsLabel: string;
  imageUrl: string | null;
};

export type BidderRowVM = {
  maskedName: string;
  joinedLabel: string;
};
