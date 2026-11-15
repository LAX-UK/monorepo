import { countSaleroomStatuses } from "@/lib/marketing/saleroom-status-counts";
import "server-only";

import { atgDisplayLot } from "@/lib/catalog/atg-catalog-display";
import { isPublicCatalogSale } from "@/lib/catalog/public-catalog-visibility";
import {
  getPublicSaleBidderCount,
  getPublicSaleShell,
} from "@/lib/data/http/public-catalogue.server";
import { getServerSaleroomStatus } from "@/lib/data/http/saleroom-status.server";
import { getLotMediaTreatments } from "@/lib/departments/lot-media-treatments.server";
import { SIGNED_OUT_SALE_VIEWER } from "@/lib/marketing/sale-viewer";
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
import { resolveSalePageState } from "@/lib/marketing/saleroom/sale-page-state";
import { staffPreviewSaleReads } from "@/lib/marketing/staff-catalogue-preview.server";
import { resolveLayoutView } from "@/lib/preferences/resolve-layout-view";
import { saleFormatExplainerContextFromSale } from "@/lib/sale-format-explainer";
import { isSaleroomDeliveryMode } from "@auction/validators";
import { notFound, permanentRedirect, redirect } from "next/navigation";

/** A sale that will not take place: its address answers with a notice, not a catalogue. */
export type SaleroomCancelledPageData = {
  kind: "cancelled";
  saleTitle: string;
};

export type SaleroomDetailPageData = {
  kind: "sale";
  vm: ReturnType<typeof buildSaleroomPageVM>;
  jsonLdText: string;
  explainerContext: ReturnType<typeof saleFormatExplainerContextFromSale>;
};

/*
 * The sale page as everyone sees it (CO-7): no session, no cookies, no request headers. Every
 * read is the session-free, tagged one from `public-catalogue.server`, the viewer is
 * `SIGNED_OUT_SALE_VIEWER`, and the browser fills in what is personal from `/api/sales/:id/me`.
 * The only exception is a sale the public cannot see, which staff may preview
 * (`staff-catalogue-preview.server`); that render is personal and never cached.
 */
export async function loadSaleroomDetailPage(input: {
  id: string;
  slug: string;
  searchParams: Record<string, string | string[] | undefined>;
}): Promise<SaleroomDetailPageData | SaleroomCancelledPageData> {
  const query = parseSaleroomPageQuery(input.searchParams);
  const shellInput = {
    saleId: input.id,
    page: query.pageNum,
    sort: query.catalogSort,
    loadAll: query.isCatalogLoadAll,
    pageSize: SALEROOM_CATALOG_PAGE_SIZE,
  };

  let service = saleroomPageDataService;
  let loaded = await service.loadShell(shellInput);
  const publiclyVisible =
    loaded != null &&
    (resolveSalePageState({ status: loaded.shell.sale.status, lotCount: 0 }) === "cancelled" ||
      isPublicCatalogSale(loaded.shell.sale));
  if (!publiclyVisible) {
    const previewReads = await staffPreviewSaleReads();
    if (!previewReads) notFound();
    service = saleroomPageDataService.withReads(previewReads);
    loaded = await service.loadShell(shellInput);
  }
  if (!loaded) notFound();
  const { shell, categoryLabel, categoryLabels } = loaded;
  // Lots of an ATG-owned sale are LAX drafts; status chips, counts and filters must read them
  // as upcoming, live or ended, so every later step works from the display copies.
  const lotsPage = {
    ...loaded.lotsPage,
    items: loaded.lotsPage.items.map((lot) => atgDisplayLot(lot, shell.sale)),
  };

  // A cancelled sale keeps its address for people who were given the link.
  const cancelled =
    resolveSalePageState({ status: shell.sale.status, lotCount: 0 }) === "cancelled";

  const slugMismatch = saleSlugMismatchPath(input.slug, shell.sale);
  if (slugMismatch) {
    permanentRedirect(canonicalSalePathWithQuery(shell.sale, input.searchParams));
  }
  if (cancelled) return { kind: "cancelled", saleTitle: shell.sale.title };
  if (firstSearchParam(input.searchParams.tab) === "overview") {
    redirect(canonicalSalePathWithQuery(shell.sale, input.searchParams));
  }

  const secondary = await service.loadSecondary(input.id, shell.sale);

  // The address decides the layout; a saved preference is applied in the browser.
  const layoutViewRaw = resolveLayoutView({
    urlView: query.urlView,
    category: "lots",
    uiPreferences: undefined,
    cookieRaw: undefined,
    fallback: "grid",
  });
  const layoutView = layoutViewRaw === "card" ? "grid" : layoutViewRaw;

  const filteredLots = service.filterCatalogLots(lotsPage.items, {
    statusFilter: query.statusFilter,
    catalogSearch: query.catalogSearch,
  });

  // Counts only while the page holds every lot, which a status or search always loads.
  const statusCounts = countSaleroomStatuses(lotsPage.items, {
    catalogSearch: query.catalogSearch,
    holdsWholeCatalogue: lotsPage.items.length + lotsPage.withdrawn.length >= lotsPage.total,
  });

  const registeredBidderCount = await getPublicSaleBidderCount(shell.sale.id).catch(() => null);
  const isSaleroomSale = isSaleroomDeliveryMode(shell.sale.deliveryMode);
  // A first paint only: the live shell reads the room's state again in the browser.
  const initialSaleroomStatus = isSaleroomSale
    ? await getServerSaleroomStatus(shell.sale.id).catch(() => ({
        status: "none" as const,
        currentLotId: null,
      }))
    : { status: "none" as const, currentLotId: null };

  // The hang opens the first page of the whole catalogue, not a filtered or later page of it.
  const hangLots =
    query.pageNum === 1 && !query.statusFilter && query.catalogSearch === ""
      ? (await service.loadHangLots(input.id, shell.sale, lotsPage)).map((lot) =>
          atgDisplayLot(lot, shell.sale),
        )
      : [];

  const vm = buildSaleroomPageVM({
    shell,
    lotsPage,
    filteredLots,
    secondary,
    query,
    layoutView,
    viewer: SIGNED_OUT_SALE_VIEWER,
    registeredBidderCount,
    initialSaleroomStatus,
    categoryLabel,
    categoryLabels,
    hangLots,
    treatments: await getLotMediaTreatments(),
    statusCounts,
  });

  const jsonLdText = buildSaleroomPageJsonLd({
    sale: shell.sale,
    basePath: vm.basePath,
    lotVMs: vm.lotVMs,
    dayGalleryVM: vm.dayGalleryVM,
    showPressSection: vm.showPressSection,
  });

  return {
    kind: "sale",
    vm,
    jsonLdText,
    explainerContext: saleFormatExplainerContextFromSale(shell.sale),
  };
}

export async function loadSaleroomDetailMetadataShell(
  id: string,
  slug: string,
  searchParams: Record<string, string | string[] | undefined>,
) {
  const shell = await getPublicSaleShell(id).catch(() => null);
  if (!shell) return null;
  const slugMismatch = saleSlugMismatchPath(slug, shell.sale);
  if (slugMismatch) {
    permanentRedirect(canonicalSalePathWithQuery(shell.sale, searchParams));
  }
  return shell;
}
