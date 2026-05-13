import { SaleroomClerkConsole } from "@/components/admin/saleroom-clerk-console";
import { AppScreen } from "@/components/dashboard/dashboard-page";
import {
  type AdminSaleroomSessionSnapshot,
  getAdminSaleById,
  getAdminSaleroomSession,
} from "@/lib/data/http/admin.server";
import { PageHeader } from "@auction/ui/components/page-header";
import Link from "next/link";
import { notFound } from "next/navigation";

type Props = {
  params: Promise<{ saleId: string }>;
  searchParams: Promise<{ error?: string }>;
};

export default async function AdminSaleroomSalePage({ params, searchParams }: Props) {
  const { saleId } = await params;
  const { error } = await searchParams;

  const saleRow = await getAdminSaleById(saleId);
  if (!saleRow) notFound();

  const saleroom: AdminSaleroomSessionSnapshot = await getAdminSaleroomSession(saleId).catch(
    (): AdminSaleroomSessionSnapshot => ({ session: null, events: [] }),
  );

  return (
    <AppScreen className="space-y-6">
      <PageHeader
        title={`Saleroom · ${saleRow.sale.title ?? saleId.slice(0, 8)}`}
        description="Clerk controls: go live, advance the current lot, hammer or pass. Viewers in this sale room receive saleroom events over the socket."
        className="border-0 pb-0"
        actions={
          <Link
            href="/admin/saleroom"
            className="inline-flex min-h-11 items-center justify-center rounded-md border border-outline-variant/30 px-4 py-2 font-label text-xs uppercase tracking-widest"
          >
            Back to hub
          </Link>
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
