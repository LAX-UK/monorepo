import type { AdminTableMoneyDisplay } from "@/lib/admin/format-admin-table-money";
import { formatAdminTableMoney } from "@/lib/admin/format-admin-table-money";
import type { AdminPayoutRow } from "@/lib/data/http/admin-parse.server";

export type AdminPayoutBoardRow = AdminPayoutRow & {
  netAmountDisplay: AdminTableMoneyDisplay;
};

export function toPayoutBoardRow(row: AdminPayoutRow): AdminPayoutBoardRow {
  return {
    ...row,
    netAmountDisplay: formatAdminTableMoney(row.netAmount, row.currency),
  };
}

export function toPayoutBoardRows(rows: readonly AdminPayoutRow[]): AdminPayoutBoardRow[] {
  return rows.map(toPayoutBoardRow);
}
