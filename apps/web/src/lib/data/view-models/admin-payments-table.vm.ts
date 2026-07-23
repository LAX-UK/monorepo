import type { AdminTableMoneyDisplay } from "@/lib/admin/format-admin-table-money";
import { formatAdminTableMoney } from "@/lib/admin/format-admin-table-money";
import type { PaymentStatus } from "@auction/types";

export type AdminPaymentTableRow = {
  id: string;
  lotId: string;
  lotTitle: string;
  buyerId: string;
  buyerLabel?: string | null;
  sellerId: string;
  amount: string;
  amountDisplay: AdminTableMoneyDisplay;
  platformFee: string;
  status: PaymentStatus;
  fulfilmentStatus: string | null;
  xeroInvoiceNumber: string | null;
  xeroOnlineInvoiceUrl: string | null;
  xeroSyncStatus: "pending_sync" | "synced" | "error" | null;
  xeroLastError: string | null;
};

export function buildAdminPaymentAmountDisplay(amount: string): AdminTableMoneyDisplay {
  return formatAdminTableMoney(amount);
}
