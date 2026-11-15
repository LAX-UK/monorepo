"use client";

import { AccountRestoreHop } from "@/components/layout/account-switcher/account-restore-hop";
import { AccountsUnavailable } from "@/components/layout/account-switcher/accounts-unavailable";
import { ReportRestoreStalled } from "@/components/layout/account-switcher/report-restore-stalled";
import { ActingEntityCookieReconciler } from "@/components/legal-entity/acting-entity-cookie-reconciler";
import { LotBidEntry, type LotBidEntryGate } from "@/components/lot-page/bid/lot-bid-entry";
import { ArtworkConditionReportCta } from "@/components/sections/artwork/artwork-condition-report-cta";
import { ArtworkWatchToggle } from "@/components/sections/artwork/artwork-watch-toggle";
import { LotMoreFromRail } from "@/components/sections/artwork/redesign/lot-more-from-rail";
import { LotBidHistoryProvider } from "@/lib/context/lot-bid-history-provider";
import { LotPortsProvider } from "@/lib/context/lot-ports";
import type { LotPageViewer } from "@/lib/lot-page/lot-page-viewer";
import { useLotPageViewerOptional } from "@/lib/lot-page/lot-page-viewer-context";
import { type ComponentProps, type ReactNode, useEffect, useState } from "react";

/*
 * The signed-in parts of the lot page (CO-7). Each takes what the cached, signed-out render knows
 * and adds what `/api/lots/:id/me` says about the person looking. Before it answers they render
 * exactly what the signed-out HTML has, so hydration matches.
 */

function useViewer(): LotPageViewer | null {
  return useLotPageViewerOptional();
}

/**
 * A signed-in person on a new device bids as the account they used last: once `/me` says this
 * browser must first be put in that account, the page gives way to the restore hop (or, when a
 * restore has just run and not taken, the retry state), as the server used to before drawing it.
 */
export function LotPageRestoreGate({
  returnTo,
  children,
}: { returnTo: string; children: ReactNode }) {
  const restore = useViewer()?.restore ?? null;
  if (!restore) return <>{children}</>;
  return restore.step === "hop" ? (
    <AccountRestoreHop href={restore.href} />
  ) : (
    <ReportRestoreStalled returnTo={returnTo}>
      <AccountsUnavailable retry={{ kind: "link", href: restore.href }} />
    </ReportRestoreStalled>
  );
}

/** Keeps the acting-account cookie in line with the account `/me` says this person acts as. */
export function LotActingEntityReconcilerIsland() {
  const viewer = useViewer();
  const [verbose, setVerbose] = useState(false);
  useEffect(() => {
    const debug = new URLSearchParams(window.location.search).get("acting_debug");
    setVerbose(debug === "1" || debug === "true");
  }, []);
  if (!viewer?.isAuthenticated || !viewer.actingLegalEntityId || viewer.actingNeedsRestore) {
    return null;
  }
  return (
    <ActingEntityCookieReconciler serverActingId={viewer.actingLegalEntityId} verbose={verbose} />
  );
}

type PublicGate = Omit<
  LotBidEntryGate,
  | "sessionUser"
  | "isOwnLot"
  | "actingLegalEntityId"
  | "biddingAccount"
  | "kycBidGate"
  | "saleRegistrationBidGate"
  | "orgModuleEnabled"
>;

export function LotBidEntryIsland({
  gate,
  ...props
}: Omit<ComponentProps<typeof LotBidEntry>, "gate"> & { gate: PublicGate }) {
  const viewer = useViewer();
  return (
    <LotBidEntry
      {...props}
      gate={{
        ...gate,
        sessionUser: viewer?.sessionUser ?? null,
        isOwnLot: viewer?.isOwnLot ?? false,
        actingLegalEntityId: viewer?.actingLegalEntityId ?? null,
        biddingAccount: viewer?.biddingAccount ?? null,
        kycBidGate: viewer?.kycBidGate ?? null,
        saleRegistrationBidGate: viewer?.saleRegistrationBidGate ?? null,
        orgModuleEnabled: viewer?.orgModuleEnabled ?? false,
      }}
    />
  );
}

export function LotWatchToggleIsland(
  props: Omit<ComponentProps<typeof ArtworkWatchToggle>, "initialWatching" | "isAuthenticated">,
) {
  const viewer = useViewer();
  return (
    <ArtworkWatchToggle
      {...props}
      initialWatching={viewer?.watching ?? false}
      isAuthenticated={viewer?.isAuthenticated ?? false}
    />
  );
}

export function LotPortsProviderIsland({ children }: { children: ReactNode }) {
  const viewer = useViewer();
  return (
    <LotPortsProvider actingEntityId={viewer?.actingLegalEntityId ?? undefined}>
      {children}
    </LotPortsProvider>
  );
}

export function LotBidHistoryProviderIsland(
  props: Omit<ComponentProps<typeof LotBidHistoryProvider>, "currentUserId">,
) {
  const viewer = useViewer();
  return <LotBidHistoryProvider {...props} currentUserId={viewer?.currentUserId ?? null} />;
}

export function LotMoreFromRailIsland(
  props: Omit<
    ComponentProps<typeof LotMoreFromRail>,
    "currentUserId" | "isAuthenticated" | "watchedLotIds"
  >,
) {
  const viewer = useViewer();
  return (
    <LotMoreFromRail
      {...props}
      currentUserId={viewer?.currentUserId ?? null}
      isAuthenticated={viewer?.isAuthenticated ?? false}
      watchedLotIds={viewer?.watchedLotIds ?? []}
    />
  );
}

export function LotConditionReportCtaIsland({
  signedOutModel,
}: {
  signedOutModel: ComponentProps<typeof ArtworkConditionReportCta>["model"];
}) {
  const viewer = useViewer();
  return <ArtworkConditionReportCta model={viewer?.conditionReport ?? signedOutModel} />;
}
