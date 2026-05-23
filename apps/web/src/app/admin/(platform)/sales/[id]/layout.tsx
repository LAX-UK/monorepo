import { SaleDetailShell } from "@/components/admin/sale-detail/sale-detail-shell";
import { loadAdminSaleDetail } from "@/lib/admin/load-sale-detail";
import type { ReactNode } from "react";

type Props = {
  params: Promise<{ id: string }>;
  children: ReactNode;
};

export default async function AdminSaleDetailLayout({ params, children }: Props) {
  const { id } = await params;
  const bundle = await loadAdminSaleDetail(id);

  return (
    <SaleDetailShell saleId={id} bundle={bundle}>
      {children}
    </SaleDetailShell>
  );
}
