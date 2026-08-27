import "server-only";

import { isSessionLookupTransientError } from "@/lib/auth/session-lookup-error";
import {
  isPublicCatalogSale,
  viewerCanSeeNonPublicCatalog,
} from "@/lib/catalog/public-catalog-visibility";
import { getServerSaleroomStatus } from "@/lib/data/http/saleroom-status.server";
import {
  getServerSaleBidderCount,
  getServerSaleMyRegistrations,
  getServerSaleShell,
} from "@/lib/data/http/sales.server";
import { getServerSessionUser } from "@/lib/data/http/session.server";
import { resolveActingContext } from "@/lib/legal-entity/acting-context.server";
import { resolveOrgModuleEnabledFromRequest } from "@/lib/legal-entity/org-module-host.server";
import { saleroomPageDataService } from "@/lib/marketing/saleroom-page-data.service";
import {
  SALEROOM_CATALOG_PAGE_SIZE,
  canonicalSalePathWithQuery,
  firstSearchParam,
  parseSaleroomPageQuery,
  saleSlugMismatchPath,
} from "@/lib/marketing/saleroom-page.query";
import { buildSaleroomPageJsonLd } from "@/lib/marketing/saleroom-page.seo";
import { buildSaleroomPageVM } from "@/lib/marketing/saleroom-page.vm";
import { resolveMarketingLayoutView } from "@/lib/preferences/resolve-marketing-layout-view.server";
import { saleFormatExplainerContextFromSale } from "@/lib/sale-format-explainer";
import { isSaleroomDeliveryMode } from "@auction/validators";
import { notFound, permanentRedirect, redirect } from "next/navigation";

export type SaleroomDetailPageData = {
  vm: ReturnType<typeof buildSaleroomPageVM>;
  jsonLdText: string;
  session: Awaited<ReturnType<typeof getServerSessionUser>>;
  explainerContext: ReturnType<typeof saleFormatExplainerContextFromSale>;
};

export async function loadSaleroomDetailPage(input: {
  id: string;
  slug: string;
  searchParams: Record<string, string | string[] | undefined>;
}): Promise<SaleroomDetailPageData> {
  const query = parseSaleroomPageQuery(input.searchParams);

  const [loaded, session] = await Promise.all([
    saleroomPageDataService.loadShell({
      saleId: input.id,
      page: query.pageNum,
      sort: query.catalogSort,
      loadAll: query.isCatalogLoadAll,
      pageSize: SALEROOM_CATALOG_PAGE_SIZE,
    }),
    getServerSessionUser().catch((error) => {
      if (isSessionLookupTransientError(error)) return null;
      throw error;
    }),
  ]);
  if (!loaded) notFound();
  const { shell, lotsPage, categoryLabel, categoryLabels } = loaded;

  const canPreviewCatalog = viewerCanSeeNonPublicCatalog(session?.role, session?.staffRole);
  if (!canPreviewCatalog && !isPublicCatalogSale(shell.sale)) {
    notFound();
  }

  const slugMismatch = saleSlugMismatchPath(input.slug, shell.sale);
  if (slugMismatch) {
    permanentRedirect(canonicalSalePathWithQuery(shell.sale, input.searchParams));
  }
  if (firstSearchParam(input.searchParams.tab) === "overview") {
    redirect(canonicalSalePathWithQuery(shell.sale, input.searchParams));
  }

  const secondary = await saleroomPageDataService.loadSecondary(input.id, shell.sale, session);
  const actingCtx = session
    ? await resolveActingContext(session.role, session.staffRole ?? null)
    : null;
  const orgModuleEnabled = await resolveOrgModuleEnabledFromRequest();
  const mySaleRegs = session ? await getServerSaleMyRegistrations(input.id).catch(() => []) : [];

  const layoutViewRaw = await resolveMarketingLayoutView({
    routeKey: "sales-lot",
    category: "lots",
    urlView: query.urlView,
    user: session,
    fallback: "grid",
  });
  const layoutView = layoutViewRaw === "card" ? "grid" : layoutViewRaw;

  const filteredLots = saleroomPageDataService.filterCatalogLots(lotsPage.items, {
    statusFilter: query.statusFilter,
    catalogSearch: query.catalogSearch,
  });

  const registeredBidderCount = await getServerSaleBidderCount(shell.sale.id).catch(() => null);
  const isSaleroomSale = isSaleroomDeliveryMode(shell.sale.deliveryMode);
  const initialSaleroomStatus = isSaleroomSale
    ? await getServerSaleroomStatus(shell.sale.id).catch(() => ({
        status: "none" as const,
        currentLotId: null,
      }))
    : { status: "none" as const, currentLotId: null };

  const vm = buildSaleroomPageVM({
    shell,
    lotsPage,
    filteredLots,
    secondary,
    query,
    layoutView,
    session,
    actingMemberships: actingCtx?.memberships ?? null,
    orgModuleEnabled,
    mySaleRegs,
    registeredBidderCount,
    initialSaleroomStatus,
    categoryLabel,
    categoryLabels,
  });

  const jsonLdText = buildSaleroomPageJsonLd({
    sale: shell.sale,
    basePath: vm.basePath,
    lotVMs: vm.lotVMs,
    dayGalleryVM: vm.dayGalleryVM,
    showPressSection: vm.showPressSection,
  });

  return {
    vm,
    jsonLdText,
    session,
    explainerContext: saleFormatExplainerContextFromSale(shell.sale),
  };
}

export async function loadSaleroomDetailMetadataShell(
  id: string,
  slug: string,
  searchParams: Record<string, string | string[] | undefined>,
) {
  const shell = await getServerSaleShell(id).catch(() => null);
  if (!shell) return null;
  const slugMismatch = saleSlugMismatchPath(slug, shell.sale);
  if (slugMismatch) {
    permanentRedirect(canonicalSalePathWithQuery(shell.sale, searchParams));
  }
  return shell;
}
