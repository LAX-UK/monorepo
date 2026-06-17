import { AdminEntityDetailShell } from "@/components/admin/admin-entity-detail-shell";
import { AdminStatusBadge } from "@/components/admin/admin-status-badge";
import { SaleroomClerkConsole } from "@/components/admin/saleroom-clerk-console";
import { SaleroomSaleSwitcher } from "@/features/saleroom/components/clerk-console/saleroom-sale-switcher";
import { SaleDeliveryModeBadge } from "@/features/saleroom/components/shared/sale-delivery-mode-badge";
import {
  type AdminSaleroomSessionSnapshot,
  getAdminSaleById,
  getAdminSalePaddleRoster,
  getAdminSaleroomSession,
  getAdminTelephoneBookings,
} from "@/lib/data/http/admin.server";
import type { SaleDeliveryMode } from "@auction/types";
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
  let saleroomLoadError: string | null = null;
  const loadWarnings: string[] = [];

  const [saleRow, saleroomResult, telephoneBookings, paddleRoster] = await Promise.all([
    getAdminSaleById(saleId),
    getAdminSaleroomSession(saleId).catch((e): AdminSaleroomSessionSnapshot => {
      saleroomLoadError = e instanceof Error ? e.message : "Could not load the saleroom session.";
      return { session: null, events: [] };
    }),
    getAdminTelephoneBookings(saleId).catch(() => {
      loadWarnings.push("Telephone bookings could not be loaded.");
      return [];
    }),
    getAdminSalePaddleRoster(saleId).catch(() => {
      loadWarnings.push("Paddle roster could not be loaded.");
      return [];
    }),
  ]);
  if (!saleRow) notFound();
  const saleroom = saleroomResult;

  const sessionStatus = saleroom.session?.status ?? "none";

  return (
    <AdminEntityDetailShell
      detailHeader
      detailHeaderSticky={false}
      backHref="/admin/saleroom"
      backLabel="Saleroom hub"
      eyebrow="Saleroom clerk"
      title={saleRow.sale.title ?? "Sale"}
      description="Go live, advance lots, hammer or pass. Viewers receive saleroom events over the socket."
      meta={
        <div className="flex flex-col gap-3">
          <div className="flex flex-wrap items-center gap-2">
            <SaleDeliveryModeBadge mode={saleRow.sale.deliveryMode as SaleDeliveryMode} />
            <AdminStatusBadge domain="saleroomSession" status={sessionStatus} size="sm" />
          </div>
          <SaleroomSaleSwitcher
            currentSaleId={saleId}
            currentSaleTitle={saleRow.sale.title ?? "Sale"}
          />
        </div>
      }
    >
      <SaleroomClerkConsole
        saleId={saleId}
        saleTitle={saleRow.sale.title ?? "Sale"}
        deliveryMode={saleRow.sale.deliveryMode as SaleDeliveryMode}
        saleStatus={saleRow.sale.status}
        initial={saleroom}
        lots={saleRow.lots}
        telephoneBookings={telephoneBookings}
        paddleRoster={paddleRoster}
        actionError={actionError ?? null}
        error={saleroomLoadError}
        loadWarnings={loadWarnings}
        registrationsHref={`/admin/sales/${saleId}/registrations#check-in`}
        paddleRosterEmpty={paddleRoster.length === 0}
        checkedInRefresh={checkedIn === "1"}
      />
    </AdminEntityDetailShell>
  );
}
