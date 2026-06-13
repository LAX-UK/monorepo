import type { PaymentStatus } from "@auction/types";

export type AdminPaymentTableRow = {
  id: string;
  lotId: string;
  lotTitle: string;
  buyerId: string;
  buyerLabel?: string | null;
  sellerId: string;
  amount: string;
  platformFee: string;
  status: PaymentStatus;
  fulfilmentStatus: string | null;
  xeroInvoiceNumber: string | null;
  xeroOnlineInvoiceUrl: string | null;
  xeroSyncStatus: "pending_sync" | "synced" | "error" | null;
  xeroLastError: string | null;
};
