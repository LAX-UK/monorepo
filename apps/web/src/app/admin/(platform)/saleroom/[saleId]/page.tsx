import { SaleroomClerkConsole } from "@/components/admin/saleroom-clerk-console";
import { AppScreen } from "@/components/dashboard/dashboard-page";
import { DashboardDetailHeader } from "@/components/dashboard/primitives/dashboard-detail-header";
import {
  type AdminSaleroomSessionSnapshot,
  getAdminSaleById,
  getAdminSaleroomSession,
} from "@/lib/data/http/admin.server";
import { LiveBadge } from "@auction/ui/components/live-badge";
import { StatusBadge } from "@auction/ui/components/status-badge";
import { notFound } from "next/navigation";

type Props = {
  params: Promise<{ saleId: string }>;
  searchParams: Promise<{ error?: string }>;
};

function saleroomStatusVariant(
  status: string | undefined,
): "live" | "success" | "neutral" | "warning" {
  const s = (status ?? "").toLowerCase();
  if (s === "live" || s === "active") return "live";
  if (s === "ended" || s === "closed") return "success";
  if (s === "paused") return "warning";
  return "neutral";
}

function saleroomStatusLabel(snapshot: AdminSaleroomSessionSnapshot): string {
  if (!snapshot.session) return "Not live";
  const s = snapshot.session.status;
  if (!s) return "Session";
  return s.charAt(0).toUpperCase() + s.slice(1).replace(/_/g, " ");
}

export default async function AdminSaleroomSalePage({ params, searchParams }: Props) {
  const { saleId } = await params;
  const { error } = await searchParams;

  const saleRow = await getAdminSaleById(saleId);
  if (!saleRow) notFound();

  const saleroom: AdminSaleroomSessionSnapshot = await getAdminSaleroomSession(saleId).catch(
    (): AdminSaleroomSessionSnapshot => ({ session: null, events: [] }),
  );

  const statusLabel = saleroomStatusLabel(saleroom);

  return (
    <AppScreen className="space-y-8">
      <DashboardDetailHeader
        sticky
        track="live"
        backHref="/admin/saleroom"
        backLabel="Saleroom hub"
        eyebrow="Saleroom clerk"
        title={saleRow.sale.title ?? "Sale"}
        description="Go live, advance lots, hammer or pass. Viewers receive saleroom events over the socket."
        badges={
          <>
            {(saleroom.session?.status ?? "").toLowerCase() === "live" ||
            (saleroom.session?.status ?? "").toLowerCase() === "active" ? (
              <LiveBadge />
            ) : null}
            <StatusBadge variant={saleroomStatusVariant(saleroom.session?.status)} size="sm">
              {statusLabel}
            </StatusBadge>
          </>
        }
      />
      <SaleroomClerkConsole
        saleId={saleId}
        saleTitle={saleRow.sale.title ?? "Sale"}
        initial={saleroom}
        lots={saleRow.lots}
        error={error ?? null}
      />
    </AppScreen>
  );
}
