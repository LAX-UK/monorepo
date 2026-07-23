import type { lotFulfilment } from "@auction/db/schema";

export type LotFulfilmentRow = typeof lotFulfilment.$inferSelect;

export type LotFulfilmentListRow = LotFulfilmentRow & { lotTitle: string | null };

export type LotFulfilmentAddressSnapshot = {
  addressId: string;
  label: string;
  line1: string;
  line2: string | null;
  city: string;
  state: string | null;
  postalCode: string;
  country: string;
  addressType: "shipping" | "billing" | "both";
};

export type AdminLotFulfilmentBaseFilter = {
  q?: string;
};

export type AdminLotFulfilmentListFilter = AdminLotFulfilmentBaseFilter & {
  status?: LotFulfilmentRow["status"];
};

export type AdminLotFulfilmentListSummary = {
  total: number;
  awaitingPickup: number;
  inTransit: number;
  statusCounts: Record<string, number>;
};

export type InsertLotFulfilmentInput = {
  lotId: string;
  paymentId: string;
  status: LotFulfilmentRow["status"];
  addressSnapshot?: LotFulfilmentAddressSnapshot | null;
};

export type UpdateLotFulfilmentInput = Partial<{
  paymentId: string;
  status: LotFulfilmentRow["status"];
  addressSnapshot: LotFulfilmentAddressSnapshot | null;
  releaseApprovedByUserId: string;
  releaseApprovedAt: Date;
  notes: string | null;
  fulfilmentMethod: LotFulfilmentRow["fulfilmentMethod"];
  shippingCarrier: string;
  trackingNumber: string;
  collectedBy: string;
  collectedAt: Date;
  updatedAt: Date;
}>;

export interface ILotFulfilmentRepository {
  findByLotId(lotId: string): Promise<LotFulfilmentRow | null>;
  insert(input: InsertLotFulfilmentInput): Promise<void>;
  updateByLotId(lotId: string, patch: UpdateLotFulfilmentInput): Promise<void>;
  listForAdmin(
    options?: AdminLotFulfilmentListFilter & { limit?: number; offset?: number },
  ): Promise<{ items: LotFulfilmentListRow[]; total: number }>;
  countMatching(filter: AdminLotFulfilmentListFilter): Promise<number>;
  summarizeForAdmin(
    baseFilter?: AdminLotFulfilmentBaseFilter,
  ): Promise<AdminLotFulfilmentListSummary>;
}

/** Hooks from lot fulfilment into the payment flow (DIP for payment services). */
export interface ILotFulfilmentPaymentHook {
  ensureAwaitingPayment(
    lotId: string,
    paymentId: string,
    addressSnapshot?: LotFulfilmentAddressSnapshot | null,
  ): Promise<void>;
  onPaymentCaptured(lotId: string, paymentId: string): Promise<void>;
}
