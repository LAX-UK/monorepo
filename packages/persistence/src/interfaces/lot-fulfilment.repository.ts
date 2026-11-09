import type { lotFulfilment } from "@auction/db/schema";

export type LotFulfilmentRow = typeof lotFulfilment.$inferSelect;

export type LotFulfilmentListRow = LotFulfilmentRow & {
  lotTitle: string | null;
  lotNumber: number | null;
  saleId: string | null;
  saleTitle: string | null;
};

export type AdminLotFulfilmentListSort = "updated_desc" | "updated_asc" | "lot_asc" | "lot_desc";

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
  collectedBy: string | null;
  /** The staff member who handed the work over. */
  collectedByUserId: string | null;
  collectedAt: Date | null;
  updatedAt: Date;
}>;

export interface ILotFulfilmentRepository {
  findByLotId(lotId: string): Promise<LotFulfilmentRow | null>;
  /** The saleroom status of each lot that has a fulfilment record; lots without one are absent. */
  statusesForLots(lotIds: readonly string[]): Promise<Map<string, LotFulfilmentRow["status"]>>;
  insert(input: InsertLotFulfilmentInput): Promise<void>;
  updateByLotId(lotId: string, patch: UpdateLotFulfilmentInput): Promise<void>;
  /**
   * Updates the lot's fulfilment only while it is in one of these statuses, as one conditional
   * statement. Returns whether it moved; false means another action got there first.
   */
  updateIfStatus(
    lotId: string,
    fromStatuses: readonly LotFulfilmentRow["status"][],
    patch: UpdateLotFulfilmentInput,
  ): Promise<boolean>;
  listForAdmin(
    options?: AdminLotFulfilmentListFilter & {
      limit?: number;
      offset?: number;
      /** Defaults to `updated_desc` (most recently changed first). */
      sort?: AdminLotFulfilmentListSort;
    },
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
