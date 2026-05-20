import { AdminEntityDetailShell } from "@/components/admin/admin-entity-detail-shell";
import { AdminStatusBadge } from "@/components/admin/admin-status-badge";
import { SaleroomClerkConsole } from "@/components/admin/saleroom-clerk-console";
import {
  type AdminSaleroomSessionSnapshot,
  getAdminSaleById,
  getAdminSaleroomSession,
} from "@/lib/data/http/admin.server";
import { LiveBadge } from "@auction/ui/components/live-badge";
import { notFound } from "next/navigation";

type Props = {
  params: Promise<{ saleId: string }>;
  searchParams: Promise<{ error?: string }>;
};

export default async function AdminSaleroomSalePage({ params, searchParams }: Props) {
  const { saleId } = await params;
  const { error } = await searchParams;

  const [saleRow, saleroomResult] = await Promise.all([
    getAdminSaleById(saleId),
    getAdminSaleroomSession(saleId).catch(
      (): AdminSaleroomSessionSnapshot => ({ session: null, events: [] }),
    ),
  ]);
  if (!saleRow) notFound();
  const saleroom = saleroomResult;

  const sessionStatus = saleroom.session?.status ?? "none";
  const isLive = sessionStatus.toLowerCase() === "live" || sessionStatus.toLowerCase() === "active";

  return (
    <AdminEntityDetailShell
      detailHeader
      backHref="/admin/saleroom"
      backLabel="Saleroom hub"
      eyebrow="Saleroom clerk"
      title={saleRow.sale.title ?? "Sale"}
      description="Go live, advance lots, hammer or pass. Viewers receive saleroom events over the socket."
      meta={
        <div className="flex flex-wrap items-center gap-2">
          {isLive ? <LiveBadge /> : null}
          <AdminStatusBadge domain="saleroomSession" status={sessionStatus} size="sm" />
        </div>
      }
    >
      <SaleroomClerkConsole
        saleId={saleId}
        saleTitle={saleRow.sale.title ?? "Sale"}
        initial={saleroom}
        lots={saleRow.lots}
        error={error ?? null}
      />
    </AdminEntityDetailShell>
  );
}
