import { AdminEntityDetailShell } from "@/components/admin/admin-entity-detail-shell";
import { AdminStatusBadge } from "@/components/admin/admin-status-badge";
import { SaleroomClerkConsole } from "@/components/admin/saleroom-clerk-console";
import { SaleroomSaleSwitcher } from "@/features/saleroom/components/clerk-console/saleroom-sale-switcher";
import { SaleDeliveryModeBadge } from "@/features/saleroom/components/shared/sale-delivery-mode-badge";
import { loadSaleroomClerkPage } from "@/lib/admin/saleroom/load-saleroom-clerk-page";
import { getAdminSaleById } from "@/lib/data/http/admin.server";
import type { Metadata } from "next";
import { notFound } from "next/navigation";

type Props = {
  params: Promise<{ saleId: string }>;
  searchParams: Promise<{ error?: string; checkedIn?: string }>;
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { saleId } = await params;
  const saleRow = await getAdminSaleById(saleId);
  if (!saleRow) {
    return { title: "Saleroom clerk" };
  }
  return {
    title: `${saleRow.sale.title ?? "Sale"} · Saleroom clerk`,
  };
}

export default async function AdminSaleroomSalePage({ params, searchParams }: Props) {
  const { saleId } = await params;
  const { error: actionError, checkedIn } = await searchParams;
  const model = await loadSaleroomClerkPage({ saleId });
  if (model.notFound) notFound();

  const sessionStatus = model.saleroom.session?.status ?? "none";

  return (
    <AdminEntityDetailShell
      detailHeader
      detailHeaderSticky={false}
      backHref="/admin/saleroom"
      backLabel="Saleroom hub"
      eyebrow="Saleroom clerk"
      title={model.saleTitle}
      description="Go live, advance lots, hammer or pass. Viewers receive saleroom events over the socket."
      meta={
        <div className="flex flex-col gap-3">
          <div className="flex flex-wrap items-center gap-2">
            <SaleDeliveryModeBadge mode={model.deliveryMode} />
            <AdminStatusBadge domain="saleroomSession" status={sessionStatus} size="sm" />
          </div>
          <SaleroomSaleSwitcher currentSaleId={saleId} currentSaleTitle={model.saleTitle} />
        </div>
      }
    >
      <SaleroomClerkConsole
        saleId={saleId}
        saleTitle={model.saleTitle}
        deliveryMode={model.deliveryMode}
        saleStatus={model.saleStatus}
        initial={model.saleroom}
        lots={model.lots}
        telephoneBookings={model.telephoneBookings}
        paddleRoster={model.paddleRoster}
        actionError={actionError ?? null}
        error={model.saleroomLoadError}
        loadWarnings={model.loadWarnings}
        registrationsHref={`/admin/sales/${saleId}/registrations#check-in`}
        paddleRosterEmpty={model.paddleRoster.length === 0}
        checkedInRefresh={checkedIn === "1"}
      />
    </AdminEntityDetailShell>
  );
}
