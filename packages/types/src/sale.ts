export const saleStatuses = ["draft", "scheduled", "active", "ended", "cancelled"] as const;
export type SaleStatus = (typeof saleStatuses)[number];

export const saleDeliveryModes = ["online", "onsite"] as const;
export type SaleDeliveryMode = (typeof saleDeliveryModes)[number];

export type Sale = {
  id: string;
  title: string;
  description: string | null;
  coverImages: string[];
  categoryId: string | null;
  deliveryMode: SaleDeliveryMode;
  streamUrl: string | null;
  /** Onsite venue name (free-form). */
  locationName: string | null;
  /**
   * Free-form single-line/multi-line address used for fallback display and
   * older records. Newer onsite sales prefer the structured address fields
   * below; UI should fall back to this string when those are missing.
   */
  locationAddress: string | null;
  /** Optional explicit map URL (Google Maps, etc.) for onsite events. */
  locationMapUrl: string | null;
  /** Structured UK-friendly address line 1 (street + number). */
  locationAddressLine1: string | null;
  /** Structured UK-friendly address line 2 (apartment, building, etc.). */
  locationAddressLine2: string | null;
  /** City / town / post town. */
  locationCity: string | null;
  /** County (UK) or region/state. */
  locationCounty: string | null;
  /** Normalized postcode (UK postcodes are stored uppercased and spaced). */
  locationPostcode: string | null;
  /** ISO country name (defaults to "United Kingdom" in admin UX). */
  locationCountry: string | null;
  status: SaleStatus;
  startTime: Date;
  endTime: Date;
  previewStartTime: Date | null;
  buyerPremiumRate: string;
  terms: string | null;
  createdBy: string;
  createdAt: Date;
  updatedAt: Date;
};

export type CreateSaleInput = {
  title: string;
  description?: string | undefined;
  coverImages?: string[] | undefined;
  /** Optional theme category (marketing + default for nested lots in admin). */
  categoryId?: string | undefined;
  deliveryMode?: SaleDeliveryMode | undefined;
  streamUrl?: string | null | undefined;
  locationName?: string | null | undefined;
  locationAddress?: string | null | undefined;
  locationMapUrl?: string | null | undefined;
  locationAddressLine1?: string | null | undefined;
  locationAddressLine2?: string | null | undefined;
  locationCity?: string | null | undefined;
  locationCounty?: string | null | undefined;
  locationPostcode?: string | null | undefined;
  locationCountry?: string | null | undefined;
  startTime: Date;
  endTime: Date;
  previewStartTime?: Date | undefined;
  buyerPremiumRate?: string | undefined;
  terms?: string | undefined;
  createdBy: string;
};
