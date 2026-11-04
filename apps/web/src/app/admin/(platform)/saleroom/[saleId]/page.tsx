import { SaleroomClerkConsole } from "@/components/admin/saleroom-clerk-console";
import { AdminFlashClear } from "@/components/admin/staff/admin-flash-clear";
import { StaffBreadcrumbs } from "@/components/admin/staff/staff-breadcrumbs";
import { SaleroomSaleSwitcher } from "@/features/saleroom/components/clerk-console/saleroom-sale-switcher";
import { readAdminFlashForPath } from "@/lib/admin/flash/flash.server";
import { redirectIfSessionExpired } from "@/lib/admin/redirect-if-session-expired.server";
import { loadSaleroomClerkPage } from "@/lib/admin/saleroom/load-saleroom-clerk-page";
import { saleroomPath } from "@/lib/admin/saleroom/saleroom-path";
import { getAdminSaleById } from "@/lib/data/http/admin.server";
import { deliveryModeShortLabel } from "@/lib/presenters/delivery-mode/delivery-mode-registry";
import { DetailPage, MetaItem } from "@auction/staff-ui";
import type { Metadata } from "next";
import { notFound } from "next/navigation";

type Props = {
  params: Promise<{ saleId: string }>;
  searchParams: Promise<{ checkedIn?: string }>;
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { saleId } = await params;
  // The page itself handles an ended session; a title must never fail the whole page.
  const saleRow = await getAdminSaleById(saleId).catch(() => null);
  if (!saleRow) {
    return { title: "Saleroom clerk" };
  }
  return {
    title: `${saleRow.sale.title ?? "Sale"} · Saleroom clerk`,
  };
}

export default async function AdminSaleroomSalePage({ params, searchParams }: Props) {
  const { saleId } = await params;
  const { checkedIn } = await searchParams;
  const flash = await readAdminFlashForPath(saleroomPath(saleId));
  const model = await redirectIfSessionExpired(() => loadSaleroomClerkPage({ saleId }));
  if (model.notFound) notFound();

  return (
    <DetailPage
      breadcrumbs={
        <StaffBreadcrumbs
          items={[{ label: "Saleroom", href: "/admin/saleroom" }, { label: model.saleTitle }]}
        />
      }
      title={model.saleTitle}
      meta={<MetaItem label="Format">{deliveryModeShortLabel(model.deliveryMode)}</MetaItem>}
      secondaryActions={
        <SaleroomSaleSwitcher currentSaleId={saleId} currentSaleTitle={model.saleTitle} />
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
        actionError={flash?.kind === "error" ? flash.message : null}
        error={model.saleroomLoadError}
        loadWarnings={model.loadWarnings}
        registrationsHref={`/admin/sales/${saleId}/registrations#check-in`}
        paddleRosterEmpty={model.paddleRoster.length === 0}
        checkedInRefresh={checkedIn === "1"}
      />
      {flash ? <AdminFlashClear path={saleroomPath(saleId)} /> : null}
    </DetailPage>
  );
}
