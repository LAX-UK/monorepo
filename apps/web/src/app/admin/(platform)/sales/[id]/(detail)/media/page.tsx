import { SaleDayPhotosTab } from "@/components/admin/sale-detail/tabs/day-photos-tab";
import { loadAdminSaleDetail } from "@/lib/admin/load-sale-detail";
import { requireAdminCapability } from "@/lib/auth/require-admin-capability";
import { SALES_ACCESS, SALE_CATALOG_ACCESS } from "@/lib/navigation/staff-nav-access";
import { type UserRole, userHasAccessTo } from "@auction/types";
import { isSaleroomDeliveryMode } from "@auction/validators";
import { notFound } from "next/navigation";

type Props = {
  params: Promise<{ id: string }>;
};

export default async function AdminSaleMediaPage({ params }: Props) {
  const { id } = await params;
  const user = await requireAdminCapability(SALE_CATALOG_ACCESS, `/admin/sales/${id}`);
  const bundle = await loadAdminSaleDetail(id);
  const { sale } = bundle;

  if (!isSaleroomDeliveryMode(sale.deliveryMode)) {
    notFound();
  }

  const canManage = userHasAccessTo(user.role as UserRole, user.staffRole ?? null, SALES_ACCESS);

  const dayImages = sale.dayImages ?? [];
  const dayImagePresentedUrls =
    (bundle.sale as typeof bundle.sale & { dayImagePresentedUrls?: string[] })
      .dayImagePresentedUrls ?? [];

  const previewUrlByKey: Record<string, string> = {};
  dayImages.forEach((ref, i) => {
    const url = dayImagePresentedUrls[i];
    if (url) previewUrlByKey[ref.key] = url;
  });

  return (
    <SaleDayPhotosTab
      saleId={id}
      saleTitle={sale.title}
      saleStatus={sale.status}
      initialDayImages={dayImages}
      previewUrlByKey={previewUrlByKey}
      canManage={canManage}
    />
  );
}
