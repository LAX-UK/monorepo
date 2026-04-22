import { OwnerBadge } from "@/components/marketing/owner-badge";
import { Badge } from "@auction/ui/components/badge";
import { Card, CardContent } from "@auction/ui/components/card";
import Image from "next/image";
import Link from "next/link";
import type { ReactNode } from "react";
import type { SaleLotCardVM } from "./view-models";

type Props = {
  lot: SaleLotCardVM;
  /**
   * OCP: callers slot in Bid / Watch / Results actions without modifying the card.
   * Pass `null` to render the card without actions (e.g. ended sales).
   */
  actions?: ReactNode;
  /** Image sizes hint — defaults to 4-col grid; override for different grids. */
  sizes?: string;
};

const DEFAULT_SIZES = "(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 25vw";

export function SaleroomLotCard({ lot, actions, sizes = DEFAULT_SIZES }: Props) {
  return (
    <Card className="group flex h-full flex-col overflow-hidden rounded-lg bg-surface-container-low/40 p-0 shadow-none ring-1 ring-outline-variant/20 transition-shadow hover:ring-outline-variant/40">
      <Link
        href={lot.href}
        className="relative block focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
        aria-label={`${lot.lotLabel ? `${lot.lotLabel}: ` : ""}${lot.title}`}
      >
        <div className="relative aspect-[4/5] bg-surface-container-high">
          {lot.imageUrl ? (
            <Image
              src={lot.imageUrl}
              alt={lot.imageAlt}
              fill
              sizes={sizes}
              className="object-cover transition-transform duration-500 motion-safe:group-hover:scale-[1.03] motion-reduce:group-hover:scale-100"
            />
          ) : (
            <div
              className="absolute inset-0 flex items-center justify-center text-xs text-on-surface-variant"
              aria-hidden
            >
              No image
            </div>
          )}
          <OwnerBadge owned={lot.viewerOwnsLot} className="absolute right-2 top-2" />
          {lot.lotLabel ? (
            <Badge
              variant="secondary"
              className="absolute left-2 top-2 rounded-sm bg-surface/90 px-2 py-0.5 font-label text-[0.6rem] font-bold uppercase tracking-widest text-on-surface"
            >
              {lot.lotLabel}
            </Badge>
          ) : null}
          {lot.isLive ? (
            <Badge
              variant="destructive"
              aria-label="Live"
              className="absolute bottom-2 left-2 rounded-full bg-error-container/90 px-2 py-0.5 font-label text-[0.6rem] font-bold uppercase tracking-widest text-on-error-container"
            >
              <span
                className="inline-block h-1.5 w-1.5 animate-pulse rounded-full bg-error"
                aria-hidden
              />
              Live
            </Badge>
          ) : null}
        </div>
      </Link>

      <CardContent className="flex flex-1 flex-col justify-between gap-3 p-4">
        <div>
          <Link
            href={lot.href}
            className="block focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
          >
            <h3 className="font-headline text-base text-on-surface group-hover:text-primary">
              {lot.title}
            </h3>
          </Link>
          {lot.estimateLabel ? (
            <p className="mt-1 font-label text-[0.65rem] uppercase tracking-widest text-primary">
              {lot.estimateLabel}
            </p>
          ) : null}
        </div>

        <dl className="flex items-baseline justify-between border-t border-outline-variant/20 pt-3">
          <div>
            <dt className="font-label text-[0.6rem] uppercase tracking-widest text-on-surface-variant">
              {lot.currentBidLabel}
            </dt>
            <dd className="font-headline text-lg text-on-surface">{lot.currentBidValue}</dd>
          </div>
          {lot.closingLabel ? (
            <div className="text-right">
              <dt className="font-label text-[0.6rem] uppercase tracking-widest text-on-surface-variant">
                Closes
              </dt>
              <dd className="font-label text-xs text-on-surface-variant">{lot.closingLabel}</dd>
            </div>
          ) : null}
        </dl>

        {actions ? <div>{actions}</div> : null}
      </CardContent>
    </Card>
  );
}
