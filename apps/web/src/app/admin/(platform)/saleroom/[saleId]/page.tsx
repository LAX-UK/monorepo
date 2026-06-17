import { AdminEntityDetailShell } from "@/components/admin/admin-entity-detail-shell";
import { AdminStatusBadge } from "@/components/admin/admin-status-badge";
import { SaleroomClerkConsole } from "@/components/admin/saleroom-clerk-console";
import { SaleroomSaleSwitcher } from "@/features/saleroom/components/clerk-console/saleroom-sale-switcher";
import { SaleDeliveryModeBadge } from "@/features/saleroom/components/shared/sale-delivery-mode-badge";
import { saleroomHubController } from "@/lib/admin/saleroom-hub-controller";
import {
  type AdminSaleroomSessionSnapshot,
  getAdminSaleById,
  getAdminSalePaddleRoster,
  getAdminSaleroomSession,
  getAdminSaleroomSessions,
  getAdminTelephoneBookings,
} from "@/lib/data/http/admin.server";
import type { SaleDeliveryMode } from "@auction/types";
import { notFound } from "next/navigation";

type Props = {
  params: Promise<{ saleId: string }>;
  searchParams: Promise<{ error?: string; checkedIn?: string }>;
};

export default async function AdminSaleroomSalePage({ params, searchParams }: Props) {
  const { saleId } = await params;
  const { error, checkedIn } = await searchParams;
  let saleroomLoadError: string | null = null;

  const [saleRow, saleroomResult, telephoneBookings, paddleRoster, hubRows] = await Promise.all([
    getAdminSaleById(saleId),
    getAdminSaleroomSession(saleId).catch((e): AdminSaleroomSessionSnapshot => {
      saleroomLoadError = e instanceof Error ? e.message : "Could not load the saleroom session.";
      return { session: null, events: [] };
    }),
    getAdminTelephoneBookings(saleId).catch(() => []),
    getAdminSalePaddleRoster(saleId).catch(() => []),
    saleroomHubController
      .fetch()
      .catch(() => ({ rows: [], summary: { liveCount: 0, scheduledCount: 0, availableCount: 0 } })),
  ]);
  if (!saleRow) notFound();
  const saleroom = saleroomResult;

  const sessionStatuses = await getAdminSaleroomSessions(hubRows.rows.map((row) => row.sale.id))
    .then((sessions) =>
      hubRows.rows.map((row) => {
        const match = sessions.find((session) => session.saleId === row.sale.id);
        return {
          id: row.sale.id,
          title: row.sale.title ?? "Sale",
          sessionStatus: match?.status ?? ("none" as const),
        };
      }),
    )
    .catch(() =>
      hubRows.rows.map((row) => ({
        id: row.sale.id,
        title: row.sale.title ?? "Sale",
        sessionStatus: "none" as const,
      })),
    );

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
          <SaleroomSaleSwitcher currentSaleId={saleId} options={sessionStatuses} />
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
        error={error ?? saleroomLoadError}
        registrationsHref={`/admin/sales/${saleId}/registrations#check-in`}
        paddleRosterEmpty={paddleRoster.length === 0}
        checkedInRefresh={checkedIn === "1"}
      />
    </AdminEntityDetailShell>
  );
}
