"use client";

import { OwnerBadge } from "@/components/marketing/owner-badge";
import { AdaptiveFrameImage } from "@/components/ui/adaptive-frame-image";
import {
  AdaptiveMediaFrame,
  AdaptiveMediaFrameContainer,
} from "@/components/ui/adaptive-media-frame";
import { HeroVerticalScrim } from "@/components/ui/hero-tone-scrim";
import { useOverlayTone } from "@/components/ui/overlay-tone-context";
import { OverlayToneText } from "@/components/ui/overlay-tone-text";
import { formatMoney } from "@/lib/format-currency";
import { EDITORIAL_BOLD_SLOTS } from "@/lib/media/overlay-slot-presets";
import { overlayPillClasses, overlayToneProps } from "@/lib/ui/overlay-tone-classes";
import type { Lot } from "@auction/types";
import { cn } from "@auction/ui";
import Link from "next/link";
import type { ReactNode } from "react";

function closingSeason(endTime: Date): string {
  return new Intl.DateTimeFormat("en-GB", { month: "short", year: "numeric" }).format(endTime);
}

export type ArchiveLotHeroRow = {
  auction: Lot;
  sellerName: string;
};

type Props = {
  row: ArchiveLotHeroRow;
  href: string;
  isOwner?: boolean;
};

function ArchiveHeroCardInner({
  row,
  isOwner,
  chip,
  img,
  href,
}: {
  row: ArchiveLotHeroRow;
  isOwner: boolean;
  chip: string;
  img: string | undefined;
  href: string;
}) {
  const a = row.auction;
  return (
    <article className="overflow-hidden rounded-xl border border-border-hairline bg-surface-container-lowest shadow-sm ring-1 ring-outline-variant/10 transition-shadow hover:shadow-md">
      <Link
        href={href}
        className="group block focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-page-bg"
      >
        <AdaptiveMediaFrameContainer className="relative aspect-[16/10] overflow-hidden bg-surface-container-low">
          <AdaptiveFrameImage
            src={img}
            alt={`${a.title} — past auction`}
            objectFit="cover"
            label="Lot artwork"
            className="absolute inset-0 size-full"
            imgClassName="size-full object-cover transition-transform duration-700 motion-safe:group-hover:scale-[1.02] motion-reduce:group-hover:scale-100"
            sizes="(max-width: 768px) 100vw, 42rem"
          />
          <HeroVerticalScrim />
          <div
            className="absolute inset-x-0 bottom-0 flex items-end justify-between gap-4 p-5 sm:p-6"
            data-overlay-content-block
          >
            <div className="min-w-0 flex-1">
              <ArchiveStatusChip>{chip}</ArchiveStatusChip>
              <OverlayToneText
                as="h3"
                variant="display"
                className="font-headline text-2xl font-light leading-tight tracking-tight drop-shadow-sm sm:text-3xl"
              >
                {a.title}
              </OverlayToneText>
            </div>
            <OwnerBadge owned={isOwner} className="shrink-0 backdrop-blur-sm" />
          </div>
        </AdaptiveMediaFrameContainer>

        <div className="flex flex-wrap items-start justify-between gap-4 border-t border-border-hairline p-5 sm:p-6">
          <div className="min-w-0 space-y-1">
            {a.medium ? (
              <p className="line-clamp-2 font-body text-sm text-on-surface-variant">{a.medium}</p>
            ) : null}
            <p className="font-body text-sm text-on-surface-variant">{row.sellerName}</p>
          </div>
          <div className="text-right">
            <p className="mb-1 font-label text-[0.65rem] font-semibold uppercase tracking-[var(--text-label-caps-tracking,0.22em)] text-on-surface-variant">
              Hammer
            </p>
            <p className="font-headline text-2xl tabular-nums text-on-surface">
              {formatMoney(a.currentPrice)}
            </p>
          </div>
        </div>
      </Link>
    </article>
  );
}

function ArchiveStatusChip({ children }: { children: ReactNode }) {
  const tone = useOverlayTone("contentBlock");
  return (
    <span
      className={cn(
        overlayPillClasses(
          tone,
          "mb-2 inline-block px-2.5 py-0.5 font-label text-[0.65rem] font-semibold uppercase tracking-[var(--text-label-caps-tracking,0.22em)]",
        ),
      )}
      {...overlayToneProps(tone)}
    >
      {children}
    </span>
  );
}

/** Editorial single-column card — distinct from staggered grid `PastAuctionCard`. */
export function ArchiveLotCardHero({ row, href, isOwner = false }: Props) {
  const a = row.auction;
  const img = a.images[0];
  const chip =
    a.status === "ended"
      ? `Ended · ${closingSeason(a.endTime)}`
      : `${a.status.replace(/_/g, " ")} · ${closingSeason(a.endTime)}`;

  const inner = (
    <ArchiveHeroCardInner row={row} isOwner={isOwner} chip={chip} img={img} href={href} />
  );

  if (!img) return inner;

  return (
    <AdaptiveMediaFrame src={img} objectFit="cover" slots={EDITORIAL_BOLD_SLOTS}>
      {inner}
    </AdaptiveMediaFrame>
  );
}
