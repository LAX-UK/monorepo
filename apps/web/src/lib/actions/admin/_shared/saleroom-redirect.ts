import { redirect } from "next/navigation";

export function redirectSaleroomError(saleId: string, message: string): never {
  redirect(`/admin/saleroom/${encodeURIComponent(saleId)}?error=${encodeURIComponent(message)}`);
}
