import { redirectWithAdminFlash } from "@/lib/admin/flash/flash.server";
import { saleroomPath } from "@/lib/admin/saleroom/saleroom-path";

export function redirectSaleroomError(saleId: string, message: string): Promise<never> {
  return redirectWithAdminFlash(saleroomPath(saleId), "error", message);
}
