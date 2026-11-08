"use client";

import { OfferAtAuctionDialog } from "@/components/artworks/offer-at-auction-dialog.client";
import { OfferOnLaxArtDialog } from "@/components/from-zoho/offer-on-lax-art-dialog.client";
import { useCanOfferAtAuction } from "@/components/from-zoho/use-offer-at-auction.client";
import { useCanOfferOnLaxArt } from "@/components/from-zoho/use-offer-on-lax-art.client";
import { NO_OFFER_LINKS } from "@/lib/offer-at-auction-links";
import { zohoProductUrl } from "@/server/domain/zoho-register.vm";
import type { AdminRegisterArtworkSummary } from "@auction/shop-contracts";
import { type OverflowAction, toast } from "@auction/staff-ui";
import { Copy, ExternalLink, Gavel, Globe, PanelRight } from "@auction/staff-ui/icons";
import { type ReactNode, useCallback, useState } from "react";

export const registerRecordHref = (registerId: string) => `/from-zoho/${registerId}`;

type RowSubject = Pick<
  AdminRegisterArtworkSummary,
  "registerId" | "title" | "kind" | "stockCode" | "zohoProductId"
>;

/**
 * The "…" menu every From Zoho row shares: Open, the two offers, Edit in Zoho and Copy stock code,
 * plus the dialogs the offers open. An offer shows only for an original that can still be offered
 * (`offerable`) and for a person allowed to make it; nothing here decides that rule, the record
 * page and the API do.
 */
export function useRegisterRowActions({
  navigate,
  zohoUrlTemplate,
  bidAdminUrl,
}: {
  navigate: (href: string) => void;
  zohoUrlTemplate: string | null;
  bidAdminUrl: string | null;
}) {
  const canOffer = useCanOfferOnLaxArt();
  const canOfferAtAuction = useCanOfferAtAuction();
  const [offering, setOffering] = useState<RowSubject | null>(null);
  const [offeringAtAuction, setOfferingAtAuction] = useState<RowSubject | null>(null);

  const actionsFor = useCallback(
    (row: RowSubject, offerable: boolean): OverflowAction[] => {
      const zohoUrl = zohoProductUrl(zohoUrlTemplate, row.zohoProductId);
      const mayOffer = offerable && row.kind === "original";
      return [
        {
          id: "open",
          label: "Open",
          icon: PanelRight,
          onSelect: () => navigate(registerRecordHref(row.registerId)),
        },
        ...(mayOffer && canOffer
          ? [
              {
                id: "offer-on-lax-art",
                label: "Offer on lax.art…",
                icon: Globe,
                onSelect: () => setOffering(row),
              },
            ]
          : []),
        ...(mayOffer && canOfferAtAuction
          ? [
              {
                id: "offer-at-auction",
                label: "Offer at auction…",
                icon: Gavel,
                onSelect: () => setOfferingAtAuction(row),
              },
            ]
          : []),
        ...(zohoUrl
          ? [
              {
                id: "edit-in-zoho",
                label: "Edit in Zoho",
                icon: ExternalLink,
                onSelect: () => window.open(zohoUrl, "_blank", "noopener,noreferrer"),
              },
            ]
          : []),
        {
          id: "copy-stock-code",
          label: "Copy stock code",
          icon: Copy,
          onSelect: () => {
            navigator.clipboard
              .writeText(row.stockCode)
              .then(() => toast.success("Stock code copied"))
              .catch(() => toast.error("Could not copy the stock code"));
          },
        },
      ];
    },
    [canOffer, canOfferAtAuction, navigate, zohoUrlTemplate],
  );

  const dialogs: ReactNode = (
    <>
      {offering ? (
        <OfferOnLaxArtDialog
          key={offering.registerId}
          open
          onOpenChange={(open) => {
            if (!open) setOffering(null);
          }}
          registerId={offering.registerId}
          title={offering.title}
        />
      ) : null}
      {offeringAtAuction ? (
        <OfferAtAuctionDialog
          key={offeringAtAuction.registerId}
          open
          onOpenChange={(open) => {
            if (!open) setOfferingAtAuction(null);
          }}
          target={{ kind: "register", registerId: offeringAtAuction.registerId }}
          title={offeringAtAuction.title}
          links={{
            ...NO_OFFER_LINKS,
            bidAdminUrl,
            zohoUrl: zohoProductUrl(zohoUrlTemplate, offeringAtAuction.zohoProductId),
          }}
        />
      ) : null}
    </>
  );

  return { actionsFor, dialogs };
}
