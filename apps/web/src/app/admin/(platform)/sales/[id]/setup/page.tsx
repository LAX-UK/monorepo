import { CatalogBreadcrumbs } from "@/components/admin/catalog";
import { CatalogFormShell } from "@/components/admin/catalog/catalog-form-shell";
import { SaleSetupWizard } from "@/components/admin/sale-form/sale-setup-wizard";
import { firstString } from "@/lib/admin/admin-list-params";
import { CATALOG_FORM_IDS } from "@/lib/admin/catalog-form-ids";
import { connectRequiredFromLots } from "@/lib/admin/connect-readiness";
import {
  loadAdminSaleDetail,
  loadAdminSalePendingRegistrationCount,
} from "@/lib/admin/load-sale-detail";
import { type SaleSetupStepId, resolveFirstIncompleteStep } from "@/lib/admin/sale-setup";
import { requireAdminCapability } from "@/lib/auth/require-admin-capability";
import { getAdminArtistList } from "@/lib/data/http/admin.server";
import { getServerCategoryReader } from "@/lib/data/http/categories.server";
import { getWriteContainer } from "@/lib/data/write-container.server";
import { isEnglishOnlyAuctionsLocked } from "@/lib/feature-flags/english-only-auctions";
import {
  buildCoverImagePreviewMap,
  saleToAdminSaleFormValues,
} from "@/lib/forms/schemas/admin-sale-defaults";
import { LOTS_ACCESS, SALES_ACCESS } from "@/lib/navigation/staff-nav-access";
import { type UserRole, userHasAccessTo } from "@auction/types";
import { redirect } from "next/navigation";

type Props = {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ step?: string }>;
};

export default async function AdminSaleSetupPage({ params, searchParams }: Props) {
  const { id } = await params;
  const sp = await searchParams;
  const user = await requireAdminCapability(LOTS_ACCESS, `/admin/sales/${id}/setup`);

  const bundle = await loadAdminSaleDetail(id);
  const { sale, lots } = bundle;

  if (sale.status !== "draft") {
    redirect(
      `/admin/sales/${id}?error=${encodeURIComponent("Setup is only available for draft sales")}`,
    );
  }

  const role = user.role as UserRole;
  const staffRole = user.staffRole ?? null;
  const canManageSale = userHasAccessTo(role, staffRole, SALES_ACCESS);
  const canEditCatalog = userHasAccessTo(role, staffRole, LOTS_ACCESS);

  const stepParam = firstString(sp.step)?.trim() as SaleSetupStepId | undefined;

  const [categories, artistResult, venuesResult, pendingRegistrationCount, connectRequiredByLotId] =
    await Promise.all([
      (await getServerCategoryReader()).tree(),
      getAdminArtistList({ includeArchived: false, limit: 200 }).catch(() => ({ rows: [] })),
      getWriteContainer()
        .adminVenues.list({
          ...(sale.createdByLegalEntityId ? { legalEntityId: sale.createdByLegalEntityId } : {}),
        })
        .catch(() => ({ ok: true as const, data: { venues: [], total: 0 }, status: 200 })),
      loadAdminSalePendingRegistrationCount(id, sale),
      Promise.resolve(connectRequiredFromLots(lots)),
    ]);

  const initialStep =
    stepParam ??
    resolveFirstIncompleteStep({
      sale,
      lots,
      pendingRegistrationCount,
      connectRequiredByLotId,
    });

  const defaultValues = saleToAdminSaleFormValues(sale);
  const saleWithCovers = bundle.sale as typeof sale & { coverImagePresentedUrls?: string[] };
  const previewUrlByKey = buildCoverImagePreviewMap(
    sale.coverImages,
    saleWithCovers.coverImagePresentedUrls ?? [],
  );

  return (
    <CatalogFormShell
      breadcrumbs={
        <CatalogBreadcrumbs
          segments={[
            { label: "Sales", href: "/admin/sales" },
            { label: sale.title, href: `/admin/sales/${id}` },
          ]}
        />
      }
      title="Set up sale"
      description="Complete each step to publish your sale."
      wizardMobile={{
        formId: CATALOG_FORM_IDS.saleSetup,
        submitLabel: canManageSale ? "Publish sale" : "Back to sale",
        cancelHref: `/admin/sales/${id}`,
      }}
    >
      <SaleSetupWizard
        saleId={id}
        initialStep={initialStep}
        defaultValues={defaultValues}
        sale={sale}
        lots={lots}
        categories={categories}
        venues={venuesResult.ok ? venuesResult.data.venues : []}
        artists={artistResult.rows}
        englishOnlyAuctionsLocked={isEnglishOnlyAuctionsLocked()}
        previewUrlByKey={previewUrlByKey}
        canManageSale={canManageSale}
        canEditCatalog={canEditCatalog}
        pendingRegistrationCount={pendingRegistrationCount}
        connectRequiredByLotId={connectRequiredByLotId}
      />
    </CatalogFormShell>
  );
}
