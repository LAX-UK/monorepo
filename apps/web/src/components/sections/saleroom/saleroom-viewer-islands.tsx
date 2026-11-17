"use client";

import { SaleAnchorTabs } from "@/components/marketing/sale-anchor-tabs";
import { SaleMobileSummaryBar } from "@/components/marketing/sale-mobile-summary-bar";
import { SaleTelephoneBiddingSection } from "@/components/marketing/sale-telephone-bidding-section";
import {
  useSaleViewer,
  useSaleViewerLoaded,
} from "@/components/sections/saleroom/sale-viewer-provider";
import { SaleroomCatalogLotsLive } from "@/components/sections/saleroom/saleroom-catalog-lots-live";
import { SaleroomCataloguePreparing } from "@/components/sections/saleroom/saleroom-catalogue-preparing";
import { SaleroomHeroActionRow } from "@/components/sections/saleroom/saleroom-hero-action-row";
import type { SaleLotCardVM } from "@/components/sections/saleroom/view-models";
import { buildSaleAnchorTabs } from "@/lib/marketing/sale-anchor-tab-list";
import type { CatalogueRow } from "@/lib/marketing/saleroom/catalogue-rows";
import {
  type SalePrimaryViewerActionInput,
  salePrimaryViewerAction,
} from "@/lib/sale/sale-primary-viewer-action";
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

/** The sale's register step for this viewer: what the hero, the phone bar and the cards offer. */
function viewerRegisterStep(
  viewer: ReturnType<typeof useSaleViewer>,
  status: SalePrimaryViewerActionInput["status"],
  deliveryMode: SalePrimaryViewerActionInput["deliveryMode"],
  offer: Pick<SalePrimaryViewerActionInput, "registrationOffered" | "saleHref">,
) {
  return salePrimaryViewerAction({ ...viewer, status, deliveryMode, ...offer });
}

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
  const loaded = useSaleViewerLoaded();
  return (
    <SaleroomHeroActionRow
      {...props}
      viewerPending={!loaded}
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
      hasApprovedRegistration={viewer.hasApprovedRegistration}
    />
  );
}

export function SaleMobileSummaryBarIsland({
  atgReadOnly,
  registerToBidSale,
  saleHref,
  ...props
}: Omit<ComponentProps<typeof SaleMobileSummaryBar>, "canParticipate" | "primaryAction"> & {
  atgReadOnly: boolean;
  /** The sale takes web registrations now: the same flag the hero's island is given. */
  registerToBidSale: boolean;
  /** Where sign-up and identity checks bring the person back to. */
  saleHref: string;
}) {
  const viewer = useSaleViewer();
  const loaded = useSaleViewerLoaded();
  const canParticipate = viewer.canParticipateAsBuyer && !atgReadOnly;
  // The hero's own decision, from the same presenter and the same viewer. Until `/me` answers the
  // viewer is only the signed-out guess, so the bar offers the lots rather than flash a button
  // that may be wrong for this person.
  const primaryAction = loaded
    ? viewerRegisterStep(viewer, props.status, props.deliveryMode ?? "online", {
        registrationOffered: registerToBidSale && canParticipate,
        saleHref,
      })
    : null;
  return (
    <SaleMobileSummaryBar
      {...props}
      canParticipate={canParticipate}
      primaryAction={primaryAction}
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
  registerToBidSale,
  saleHref,
  rows,
  ...props
}: Omit<
  ComponentProps<typeof SaleroomCatalogLotsLive>,
  "isAuthenticated" | "canParticipate" | "bidViewer"
> & {
  atgReadOnly: boolean;
  /** The sale takes web registrations now: the same flag the hero's island is given. */
  registerToBidSale: boolean;
  /** Where sign-up and identity checks bring the person back to. */
  saleHref: string;
}) {
  const viewer = useSaleViewer();
  const loaded = useSaleViewerLoaded();
  const canParticipate = viewer.canParticipateAsBuyer && !atgReadOnly;
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
  const sale = props.saleForLifecycle;
  // The hero's register step for this person, from the same presenter, so a card never says
  // "Register to bid" to someone the hero considers registered (or the other way round).
  const register = sale
    ? viewerRegisterStep(viewer, sale.status, sale.deliveryMode, {
        registrationOffered: registerToBidSale && canParticipate,
        saleHref,
      })
    : null;
  return (
    <SaleroomCatalogLotsLive
      {...props}
      rows={personalRows}
      isAuthenticated={viewer.isAuthenticated}
      canParticipate={canParticipate}
      bidViewer={
        loaded
          ? {
              signedIn: viewer.isAuthenticated,
              register: register ? { href: register.href } : null,
            }
          : null
      }
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
