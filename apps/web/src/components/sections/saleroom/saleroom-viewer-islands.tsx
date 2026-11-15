"use client";

import { SaleAnchorTabs } from "@/components/marketing/sale-anchor-tabs";
import { SaleMobileSummaryBar } from "@/components/marketing/sale-mobile-summary-bar";
import { SaleTelephoneBiddingSection } from "@/components/marketing/sale-telephone-bidding-section";
import { useSaleViewer } from "@/components/sections/saleroom/sale-viewer-provider";
import { SaleroomCatalogLotsLive } from "@/components/sections/saleroom/saleroom-catalog-lots-live";
import { SaleroomCataloguePreparing } from "@/components/sections/saleroom/saleroom-catalogue-preparing";
import { SaleroomHeroActionRow } from "@/components/sections/saleroom/saleroom-hero-action-row";
import type { SaleLotCardVM } from "@/components/sections/saleroom/view-models";
import { buildSaleAnchorTabs } from "@/lib/marketing/sale-anchor-tab-list";
import type { CatalogueRow } from "@/lib/marketing/saleroom/catalogue-rows";
import {
  parseLayoutViewCookie,
  viewCookieName,
} from "@auction/marketing-ui/catalog-view/catalog-view";
import { replaceMarketingViewUrl } from "@auction/marketing-ui/catalog-view/catalog-view-url-store";
import { type ComponentProps, useLayoutEffect, useMemo } from "react";

/*
 * The signed-in parts of the sale page (CO-7). Each takes the props the cached, signed-out render
 * knows and adds what `useSaleViewer()` says about the person looking. Before `/me` answers they
 * render exactly what the signed-out HTML has, so hydration matches.
 */

type HeroActionRowProps = ComponentProps<typeof SaleroomHeroActionRow>;

export function SaleroomHeroActionRowIsland({
  registerToBidSale,
  saleCurrency,
  ...props
}: Omit<
  HeroActionRowProps,
  "isAuthenticated" | "initialFollowing" | "registerToBid" | "hasApprovedRegistration"
> & {
  /** The sale takes web registrations now; whether this person may is the viewer's part. */
  registerToBidSale: boolean;
  saleCurrency: string;
}) {
  const viewer = useSaleViewer();
  return (
    <SaleroomHeroActionRow
      {...props}
      isAuthenticated={viewer.isAuthenticated}
      initialFollowing={viewer.isFollowing}
      registerToBid={{
        show: registerToBidSale && viewer.canParticipateAsBuyer,
        buyerEntities: viewer.buyerEntities,
        registrationPaused: viewer.registrationPaused,
        myRegistrations: viewer.myRegistrations,
        kycApproved: viewer.kycApproved,
        kycFeedback: viewer.kycFeedback,
        orgModuleEnabled: viewer.orgModuleEnabled,
        saleCurrency,
      }}
      hasApprovedRegistration={viewer.myRegistrations.some((r) => r.status === "approved")}
    />
  );
}

export function SaleMobileSummaryBarIsland({
  atgReadOnly,
  ...props
}: Omit<ComponentProps<typeof SaleMobileSummaryBar>, "canParticipate"> & {
  atgReadOnly: boolean;
}) {
  const viewer = useSaleViewer();
  return (
    <SaleMobileSummaryBar
      {...props}
      canParticipate={viewer.canParticipateAsBuyer && !atgReadOnly}
    />
  );
}

export function SaleAnchorTabsIsland({
  telephoneSale,
  showGallery,
  showPress,
}: {
  telephoneSale: boolean;
  showGallery: boolean;
  showPress: boolean;
}) {
  const viewer = useSaleViewer();
  const tabs = useMemo(
    () =>
      buildSaleAnchorTabs({
        showTelephone: telephoneSale && viewer.canParticipateAsBuyer,
        showGallery,
        showPress,
      }),
    [telephoneSale, viewer.canParticipateAsBuyer, showGallery, showPress],
  );
  return <SaleAnchorTabs tabs={tabs} />;
}

export function SaleroomCataloguePreparingIsland(
  props: Omit<
    ComponentProps<typeof SaleroomCataloguePreparing>,
    "isAuthenticated" | "initialFollowing"
  >,
) {
  const viewer = useSaleViewer();
  return (
    <SaleroomCataloguePreparing
      {...props}
      isAuthenticated={viewer.isAuthenticated}
      initialFollowing={viewer.isFollowing}
    />
  );
}

export function SaleroomCatalogLotsLiveIsland({
  atgReadOnly,
  rows,
  ...props
}: Omit<ComponentProps<typeof SaleroomCatalogLotsLive>, "isAuthenticated" | "canParticipate"> & {
  atgReadOnly: boolean;
}) {
  const viewer = useSaleViewer();
  const watched = useMemo(() => new Set(viewer.watchedLotIds), [viewer.watchedLotIds]);
  const personalRows = useMemo(
    () =>
      watched.size === 0
        ? rows
        : rows.map(
            (row): CatalogueRow<SaleLotCardVM> =>
              row.kind === "lot" && watched.has(row.lot.id)
                ? { ...row, lot: { ...row.lot, viewerIsWatching: true } }
                : row,
          ),
    [rows, watched],
  );
  return (
    <SaleroomCatalogLotsLive
      {...props}
      rows={personalRows}
      isAuthenticated={viewer.isAuthenticated}
      canParticipate={viewer.canParticipateAsBuyer && !atgReadOnly}
    />
  );
}

export function SaleTelephoneBiddingIsland({
  telephoneSale,
  ...props
}: Pick<
  ComponentProps<typeof SaleTelephoneBiddingSection>,
  "saleId" | "saleTitle" | "loginNextPath"
> & { telephoneSale: boolean }) {
  const viewer = useSaleViewer();
  if (!telephoneSale || !viewer.canParticipateAsBuyer) return null;
  return (
    <SaleTelephoneBiddingSection
      {...props}
      isAuthenticated={viewer.isAuthenticated}
      kycApproved={viewer.kycApproved}
      mobile={viewer.mobile}
      phoneNumberVerified={viewer.phoneNumberVerified}
      {...(viewer.mobileDisplay ? { mobileDisplay: viewer.mobileDisplay } : {})}
      buyerEntities={viewer.buyerEntities}
      existingBooking={viewer.telephoneBooking}
      orgModuleEnabled={viewer.orgModuleEnabled}
    />
  );
}

/**
 * Applies a saved grid/list choice. The cached page knows only the address (`?view=`), so a
 * choice saved in this browser is applied here, before the first paint where possible, without
 * changing the address or refetching the page.
 */
export function SaleLayoutPreference({ routeKey }: { routeKey: string }) {
  useLayoutEffect(() => {
    if (new URLSearchParams(window.location.search).has("view")) return;
    const name = `${viewCookieName(routeKey)}=`;
    const raw = document.cookie
      .split("; ")
      .find((part) => part.startsWith(name))
      ?.slice(name.length);
    if (parseLayoutViewCookie(raw) === "list") {
      replaceMarketingViewUrl(`${window.location.pathname}${window.location.hash}`, "list");
    }
  }, [routeKey]);
  return null;
}
