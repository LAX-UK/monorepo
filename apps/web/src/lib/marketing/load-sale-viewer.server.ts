import "server-only";

import { isSessionLookupTransientError } from "@/lib/auth/session-lookup-error";
import {
  isPublicCatalogSale,
  viewerCanSeeNonPublicCatalog,
} from "@/lib/catalog/public-catalog-visibility";
import type { SessionUser } from "@/lib/data/contracts";
import { getServerKycStatusSummary } from "@/lib/data/http/kyc.server";
import { getPublicSaleShell } from "@/lib/data/http/public-catalogue.server";
import { getServerSaleFollowState } from "@/lib/data/http/saleroom.server";
import { getServerSaleMyRegistrations, getServerSaleShell } from "@/lib/data/http/sales.server";
import { getServerSessionUser } from "@/lib/data/http/session.server";
import { getServerTelephoneBookingForSale } from "@/lib/data/http/telephone-booking.server";
import { getServerWatchedLotIdSet } from "@/lib/data/http/watchlist.server";
import { isKycStatusUnavailableError } from "@/lib/kyc/kyc-status-unavailable-error";
import { lookupActingContext } from "@/lib/legal-entity/acting-context.server";
import { resolveOrgModuleEnabledFromRequest } from "@/lib/legal-entity/org-module-host.server";
import {
  SIGNED_OUT_SALE_VIEWER,
  type SaleViewerVM,
  buildSaleViewerVM,
} from "@/lib/marketing/sale-viewer";
import { resolveSalePageState } from "@/lib/marketing/saleroom/sale-page-state";
import type { Sale } from "@auction/types";
import { isSaleroomDeliveryMode } from "@auction/validators";

export type SaleViewerLookup = { kind: "not_found" } | { kind: "viewer"; viewer: SaleViewerVM };

async function currentSession(): Promise<SessionUser | null> {
  return getServerSessionUser().catch((error) => {
    if (isSessionLookupTransientError(error)) return null;
    throw error;
  });
}

function publiclyVisible(sale: Sale): boolean {
  return (
    resolveSalePageState({ status: sale.status, lotCount: 0 }) === "cancelled" ||
    isPublicCatalogSale(sale)
  );
}

/**
 * What the sale page shows only to the person asking (`GET /api/sales/:id/me`). It answers for
 * the caller's own session and nothing else, and with the page's 404 rules: a sale the caller may
 * not see is `not_found`, whoever asks. A signed-out caller gets `SIGNED_OUT_SALE_VIEWER`, the
 * same shape the cached page was rendered with.
 */
export async function loadSaleViewer(saleId: string): Promise<SaleViewerLookup> {
  const [publicShell, session] = await Promise.all([getPublicSaleShell(saleId), currentSession()]);

  let sale: Sale | null =
    publicShell && publiclyVisible(publicShell.sale) ? publicShell.sale : null;
  if (!sale && viewerCanSeeNonPublicCatalog(session?.role, session?.staffRoles)) {
    sale = (await getServerSaleShell(saleId))?.sale ?? null;
  }
  if (!sale) return { kind: "not_found" };
  if (!session) return { kind: "viewer", viewer: SIGNED_OUT_SALE_VIEWER };

  const [follow, kycLookup, watchedLotIds, telephoneBooking, actingLookup, mySaleRegs, orgModule] =
    await Promise.all([
      getServerSaleFollowState(saleId).catch(() => ({ isFollowing: false })),
      getServerKycStatusSummary()
        .then((summary) => ({ summary, unavailable: false }))
        .catch((error) => {
          if (isKycStatusUnavailableError(error)) return { summary: null, unavailable: true };
          throw error;
        }),
      getServerWatchedLotIdSet(),
      isSaleroomDeliveryMode(sale.deliveryMode)
        ? getServerTelephoneBookingForSale(saleId).catch(() => null)
        : Promise.resolve(null),
      // While the accounts cannot be read the page offers no account choice, as signed out.
      lookupActingContext(session.role, session.staffRoles),
      getServerSaleMyRegistrations(saleId).catch(() => []),
      resolveOrgModuleEnabledFromRequest(),
    ]);

  return {
    kind: "viewer",
    viewer: buildSaleViewerVM({
      session,
      isFollowing: follow.isFollowing,
      watchedLotIds,
      actingMemberships: actingLookup.ok ? actingLookup.context.memberships : null,
      mySaleRegs,
      kycSummary: kycLookup.summary,
      kycUnavailable: kycLookup.unavailable,
      orgModuleEnabled: orgModule,
      telephoneBooking,
    }),
  };
}
