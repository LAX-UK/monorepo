import "server-only";

import { pendingRestore } from "@/components/shell/restore-frame";
import { usesBidAsClient } from "@/lib/auth/client-audience";
import { isSessionLookupTransientError } from "@/lib/auth/session-lookup-error";
import {
  isPublicCatalogLot,
  viewerCanSeeNonPublicCatalog,
} from "@/lib/catalog/public-catalog-visibility";
import { getServerDataContainer } from "@/lib/data/container.server";
import type { SessionUser } from "@/lib/data/contracts";
import { getServerSessionUser } from "@/lib/data/http/session.server";
import { withdrawnLotPageExists } from "@/lib/lot-page/load-withdrawn-lot.server";
import { type LotPageViewer, lotPageViewerFrom } from "@/lib/lot-page/lot-page-viewer";
import { buildLotPageViewModel } from "@/lib/marketing/lot-page-vm";
import { loadPublicLotSecondary, loadPublicLotShell } from "@/lib/marketing/public-lot-page-data";
import { lotPath } from "@/lib/seo/url";

export type LotViewerLookup = { kind: "not_found" } | { kind: "viewer"; viewer: LotPageViewer };

async function currentSession(): Promise<SessionUser | null> {
  return getServerSessionUser().catch((error) => {
    if (isSessionLookupTransientError(error)) return null;
    throw error;
  });
}

/**
 * What the lot page shows only to the person asking (`GET /api/lots/:id/me`). The caller's own
 * session and nothing else, with the page's 404 rules: a lot the caller may not see is
 * `not_found`. Signed out, the answer is the signed-out viewer the cached page was drawn with.
 * Signed in, it is the same view model the page used to build with the session, so every rule
 * (own lot, accounts, registration, KYC, condition report) is unchanged.
 */
export async function loadLotViewer(lotId: string): Promise<LotViewerLookup> {
  const [publicShell, session] = await Promise.all([loadPublicLotShell(lotId), currentSession()]);
  const publiclyVisible =
    publicShell != null &&
    isPublicCatalogLot(publicShell.auction, publicShell.saleBundle?.sale ?? null);

  if (!session) {
    if (publicShell && publiclyVisible) {
      const vm = buildLotPageViewModel({
        shell: publicShell,
        secondary: await loadPublicLotSecondary(publicShell),
        searchParams: {},
        serverNow: Date.now(),
      });
      return { kind: "viewer", viewer: lotPageViewerFrom(vm) };
    }
    return { kind: "not_found" };
  }

  if (!publiclyVisible && !viewerCanSeeNonPublicCatalog(session.role, session.staffRoles)) {
    return { kind: "not_found" };
  }

  const container = await getServerDataContainer();
  const shell = await container.lotPage.loadShell(lotId);
  if (!shell) {
    // A withdrawn lot keeps its page, which has nothing personal on it.
    return (await withdrawnLotPageExists(lotId)) === "exists" && publicShell
      ? {
          kind: "viewer",
          viewer: lotPageViewerFrom(
            buildLotPageViewModel({
              shell: publicShell,
              secondary: await loadPublicLotSecondary(publicShell),
              searchParams: {},
              serverNow: Date.now(),
            }),
          ),
        }
      : { kind: "not_found" };
  }
  const vm = buildLotPageViewModel({
    shell,
    secondary: await container.lotPage.loadSecondary(shell),
    searchParams: {},
    serverNow: Date.now(),
  });
  // A signed-in person on a new device bids as the account they used last: put this browser in
  // it first (the page used to do this on the server).
  const restore = usesBidAsClient(session)
    ? await pendingRestore(vm.actingCtx.needsRestore, lotPath(vm.auction))
    : null;
  return { kind: "viewer", viewer: lotPageViewerFrom(vm, { restore }) };
}
