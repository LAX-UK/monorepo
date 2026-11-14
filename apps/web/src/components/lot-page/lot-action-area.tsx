"use client";

import { LotArtistAlertsButton } from "@/components/lot-page/lot-artist-alerts-button";
import { LotPhoneBar } from "@/components/lot-page/lot-phone-bar";
import { dashboardCheckoutLotUrl } from "@/lib/dashboard/dashboard-copy";
import type { LotPageView } from "@/lib/lot-page/build-lot-page-view";
import type { LotActionSurface } from "@/lib/lot-page/lot-action-surface";
import { useLotPageViewerOptional } from "@/lib/lot-page/lot-page-viewer-context";
import { buildPhoneBarSummary } from "@/lib/lot-page/phone-bar";
import { ButtonLink } from "@auction/ui/lax/button-link";
import { ArrowLeft, Mail, Receipt } from "lucide-react";
import Link from "next/link";
import { type ReactNode, type RefObject, useRef } from "react";

/** What the action area may need; each surface takes only its own part. */
export type LotActionContext = {
  /** The bid area: the bid button and the dialog it opens. */
  bidEntry: ReactNode;
  lotId: string;
  artist: { id: string; name: string } | null;
  signedIn: boolean;
  lotPath: string;
  saleHref: string;
  saleLabel: string;
};

/** `target` is the area itself, which a phone bar standing in for it watches. */
type SurfaceRenderer = (
  ctx: LotActionContext,
  view: LotPageView,
  target: RefObject<HTMLDivElement | null>,
) => ReactNode;

/** One renderer per surface, so a new kind of action is a new row. */
const SURFACES: Readonly<Record<LotActionSurface, SurfaceRenderer>> = {
  bid_entry: (ctx) => ctx.bidEntry,
  artist_alerts: (ctx) =>
    ctx.artist ? (
      <LotArtistAlertsButton
        artistId={ctx.artist.id}
        artistName={ctx.artist.name}
        signedIn={ctx.signedIn}
        returnPath={ctx.lotPath}
      />
    ) : null,
  pay: (ctx, view, target) => <PayAction ctx={ctx} view={view} target={target} />,
  view_purchase: (ctx) => (
    <ButtonLink
      href={`/purchases/${ctx.lotId}`}
      Link={Link}
      variant="secondary"
      size="lg"
      icon={<Receipt aria-hidden />}
      className="w-full"
    >
      View purchase
    </ButtonLink>
  ),
  enquire: () => (
    <div className="grid gap-3">
      <ButtonLink
        href="/contact"
        Link={Link}
        size="lg"
        variant="secondary"
        icon={<Mail aria-hidden />}
        className="w-full"
      >
        Enquire about this work
      </ButtonLink>
      <p className="m-0 text-lax-13 leading-5 text-lax-muted">
        Client services can tell you whether the work is still available.
      </p>
    </div>
  ),
  back_to_sale: (ctx) => (
    <ButtonLink
      href={ctx.saleHref}
      Link={Link}
      variant="secondary"
      size="lg"
      icon={<ArrowLeft aria-hidden />}
      className="w-full"
    >
      {ctx.saleLabel}
    </ButtonLink>
  ),
  none: () => null,
};

/** Paying for a won lot: the button, and the phone bar that carries it once it scrolls away. */
function PayAction({
  ctx,
  view,
  target,
}: {
  ctx: LotActionContext;
  view: LotPageView;
  target: RefObject<HTMLDivElement | null>;
}) {
  // A won lot has no clock, so the bar needs no reading of the time.
  const summary = buildPhoneBarSummary(view, 0);
  const label = view.price.amountText ? `Pay ${view.price.amountText}` : "Pay for this lot";
  const href = dashboardCheckoutLotUrl(ctx.lotId);
  return (
    <>
      <ButtonLink href={href} Link={Link} variant="primary" size="lg" className="w-full">
        {label}
      </ButtonLink>
      {summary ? (
        <LotPhoneBar summary={summary} target={target}>
          <ButtonLink
            href={href}
            Link={Link}
            variant="primary"
            size="lg"
            className="w-auto min-w-[8.25rem] shrink-0"
          >
            {label}
          </ButtonLink>
        </LotPhoneBar>
      ) : null}
    </>
  );
}

export function LotActionArea({
  surface,
  context,
  view,
}: {
  surface: LotActionSurface;
  context: LotActionContext;
  view: LotPageView;
}) {
  const target = useRef<HTMLDivElement | null>(null);
  // The cached page is drawn signed out; the person looking comes from `/api/lots/:id/me`.
  const viewer = useLotPageViewerOptional();
  const ctx = viewer ? { ...context, signedIn: viewer.isAuthenticated } : context;
  const content = SURFACES[surface](ctx, view, target);
  if (content === null) return null;
  return (
    <div ref={target} className="mt-4">
      {content}
    </div>
  );
}
