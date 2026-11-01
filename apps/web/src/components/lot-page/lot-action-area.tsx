"use client";

import { LotArtistAlertsButton } from "@/components/lot-page/lot-artist-alerts-button";
import type { LotActionSurface } from "@/lib/lot-page/lot-action-surface";
import { ButtonLink } from "@auction/ui/lax";
import { ArrowLeft, Mail } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";

/** What the action area may need; each surface takes only its own part. */
export type LotActionContext = {
  /** The bid entry, until the bid dialog replaces it. */
  bidEntry: ReactNode;
  artist: { id: string; name: string } | null;
  signedIn: boolean;
  lotPath: string;
  saleHref: string;
  saleLabel: string;
};

type SurfaceRenderer = (ctx: LotActionContext) => ReactNode;

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

export function LotActionArea({
  surface,
  context,
}: {
  surface: LotActionSurface;
  context: LotActionContext;
}) {
  const content = SURFACES[surface](context);
  if (content === null) return null;
  return <div className="mt-4">{content}</div>;
}
