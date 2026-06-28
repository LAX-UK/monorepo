import type { SaleDeliveryMode, SalePressRef, SaleStatus } from "./sale.js";

/** Minimal sale context attached to a flattened press archive row. */
export type PressArchiveSaleRef = {
  id: string;
  title: string;
  status: SaleStatus;
  deliveryMode: SaleDeliveryMode;
  endTime: Date | null;
  updatedAt: Date;
};

/** One curated press item in site-wide archive context. */
export type PressArchiveEntry = {
  sale: PressArchiveSaleRef;
  item: SalePressRef;
};

/** Ended sale with auction-day media for the press hub rail. */
export type PressDayMediaSaleSummary = {
  id: string;
  title: string;
  deliveryMode: SaleDeliveryMode;
  endTime: Date | null;
  coverImages: string[];
  dayImageCount: number;
};

/** Aggregate metadata for the press hub, RSS, and sitemap freshness. */
export type PressHubMeta = {
  /** Total matching the active filters (pagination total). */
  total: number;
  /** Total articles in the full archive (ignores active year/q/mention filters). */
  archiveTotal: number;
  /** Distinct outlet names across the full archive. */
  outletCount: number;
  lastUpdated: Date | null;
  /** Distinct publication years across the full archive (ignores active year/q filters). */
  availableYears: number[];
};

/** Lightweight sale freshness row for sitemap `lastModified` tuning. */
export type PressSitemapSaleFreshness = {
  saleId: string;
  title: string;
  lastModified: Date;
  previewImageSrc: string | null;
};
