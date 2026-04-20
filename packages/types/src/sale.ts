export const saleStatuses = ["draft", "scheduled", "active", "ended", "cancelled"] as const;
export type SaleStatus = (typeof saleStatuses)[number];

export const saleDeliveryModes = ["online", "onsite", "hybrid"] as const;
export type SaleDeliveryMode = (typeof saleDeliveryModes)[number];

export type Sale = {
  id: string;
  title: string;
  description: string | null;
  coverImages: string[];
  categoryId: string | null;
  deliveryMode: SaleDeliveryMode;
  streamUrl: string | null;
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
  startTime: Date;
  endTime: Date;
  previewStartTime?: Date | undefined;
  buyerPremiumRate?: string | undefined;
  terms?: string | undefined;
  createdBy: string;
};
