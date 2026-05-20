import { LotViewTransitionLink } from "@/components/marketing/lot-view-transition-link";
import { MarketingLotTile } from "@/components/marketing/marketing-lot-tile";
import { LOT_TRANSITION_IMAGE_ATTR, LOT_TRANSITION_ROOT_ATTR } from "@/lib/view-transitions";
import { cn } from "@auction/ui";
import Link from "next/link";
import type { ComponentProps, ReactNode } from "react";

type NavLinkProps = Pick<
  ComponentProps<typeof Link>,
  "href" | "className" | "children" | "aria-label" | "aria-hidden" | "tabIndex"
>;

function LotCardNavLink({ lotId, href, ...rest }: NavLinkProps & { lotId?: string | undefined }) {
  if (lotId != null) {
    return <LotViewTransitionLink lotId={lotId} href={href} {...rest} />;
  }
  return <Link href={href} {...rest} />;
}

const mediaHover =
  "transition-transform duration-700 ease-out motion-safe:group-hover:scale-[1.03] motion-reduce:group-hover:scale-100";

const cardShell =
  "group relative block overflow-hidden rounded-lg bg-surface-container-low ring-1 ring-outline-variant/10 shadow-sm motion-safe:transition-transform motion-safe:duration-300 motion-safe:ease-out motion-safe:hover:-translate-y-0.5";

export type LotCardGridProps = {
  href: string;
  /** When set, enables list → detail image morph on navigation. */
  lotId?: string;
  /** Full-bleed media (typically `MediaImage`). */
  image: ReactNode;
  title: ReactNode;
  meta?: ReactNode;
  /** Pointer-events-none overlays (e.g. owner badge). */
  topLeft?: ReactNode;
  /** Interactive overlays (e.g. watchlist heart) — rendered OUTSIDE the link to avoid nested anchors. */
  topRight?: ReactNode;
  /** Pointer-events-none overlays (e.g. status timer). */
  bottomLeft?: ReactNode;
  className?: string;
};

/** Uniform `4/5` tile — catalogue grid (object-contain on neutral field per design language). */
export function LotCardGrid({
  href,
  lotId,
  image,
  title,
  meta,
  topLeft,
  topRight,
  bottomLeft,
  className,
}: LotCardGridProps) {
  return (
    <article
      className={cn(cardShell, className)}
      {...(lotId ? { [LOT_TRANSITION_ROOT_ATTR]: lotId } : {})}
    >
      <LotCardNavLink lotId={lotId} href={href} className="block">
        <div
          {...{ [LOT_TRANSITION_IMAGE_ATTR]: true }}
          className="relative aspect-[4/5] bg-surface-container-low"
        >
          <div className={cn("absolute inset-0", mediaHover)}>{image}</div>
          {topLeft ? (
            <div className="pointer-events-none absolute left-1.5 top-1.5 z-[1] md:left-3 md:top-3">
              {topLeft}
            </div>
          ) : null}
          {bottomLeft ? (
            <div className="pointer-events-none absolute bottom-1.5 left-1.5 z-[1] md:bottom-3 md:left-3">
              {bottomLeft}
            </div>
          ) : null}
        </div>
        <div className="p-3 md:p-5">
          {title}
          {meta}
        </div>
      </LotCardNavLink>
      {topRight ? (
        <div className="pointer-events-auto absolute right-1.5 top-1.5 z-[2] md:right-3 md:top-3">
          {topRight}
        </div>
      ) : null}
    </article>
  );
}

export type LotCardListProps = {
  href: string;
  lotId?: string;
  image: ReactNode;
  title: ReactNode;
  subtitle?: ReactNode;
  footer?: ReactNode;
  /** Interactive trailing content (e.g. watchlist heart) — rendered OUTSIDE the link. */
  trailing?: ReactNode;
  className?: string;
};

/** Dense row — `1/1` thumb `size-24` (sm `size-24` per spec). */
export function LotCardList({
  href,
  lotId,
  image,
  title,
  subtitle,
  footer,
  trailing,
  className,
}: LotCardListProps) {
  return (
    <article
      className={cn(
        "group relative flex gap-4 p-4 transition-colors hover:bg-surface-container-low/50 sm:gap-5 sm:p-5",
        className,
      )}
      {...(lotId ? { [LOT_TRANSITION_ROOT_ATTR]: lotId } : {})}
    >
      <LotCardNavLink
        lotId={lotId}
        href={href}
        className="absolute inset-0 z-0"
        aria-hidden="true"
        tabIndex={-1}
      />
      <span
        {...{ [LOT_TRANSITION_IMAGE_ATTR]: true }}
        className="relative z-[1] size-20 shrink-0 overflow-hidden rounded-lg bg-surface-container-low sm:size-24"
      >
        {image}
      </span>
      <div className="relative z-[1] min-w-0 flex-1">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <LotCardNavLink lotId={lotId} href={href} className="min-w-0">
            {title}
            {subtitle}
          </LotCardNavLink>
          {trailing ? (
            <div className="pointer-events-auto relative z-[2] shrink-0">{trailing}</div>
          ) : null}
        </div>
        {footer ? (
          <div className="mt-3 flex flex-wrap items-center justify-between gap-3">{footer}</div>
        ) : null}
      </div>
    </article>
  );
}

export type LotCardEditorialBoldProps = {
  href: string;
  image: ReactNode;
  title: ReactNode;
  description?: ReactNode;
  footer?: ReactNode;
  /** Interactive overlays (e.g. watchlist heart) — rendered OUTSIDE the link. */
  topRight?: ReactNode;
  className?: string;
};

/** `16/9` editorial canvas — bold overlay (gradient + title on image). */
export function LotCardEditorialBold({
  href,
  image,
  title,
  description,
  footer,
  topRight,
  className,
}: LotCardEditorialBoldProps) {
  return (
    <article
      className={cn(
        "group relative block overflow-hidden rounded-xl border border-border-hairline bg-surface-container-lowest shadow-sm",
        className,
      )}
    >
      <Link href={href} className="block">
        <div className="relative aspect-video bg-surface-container-low">
          <div className={cn("absolute inset-0", mediaHover)}>{image}</div>
          <div
            className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent"
            aria-hidden
          />
          <div className="absolute inset-x-0 bottom-0 z-[1] space-y-2 p-6 text-white">
            {title}
            {description}
          </div>
        </div>
        {footer ? <div className="space-y-2 p-6">{footer}</div> : null}
      </Link>
      {topRight ? (
        <div className="pointer-events-auto absolute right-3 top-3 z-[2]">{topRight}</div>
      ) : null}
    </article>
  );
}

export type LotCardEditorialCalmProps = {
  href: string;
  image: ReactNode;
  title: ReactNode;
  description?: ReactNode;
  footer?: ReactNode;
  /** Interactive overlays (e.g. watchlist heart) — rendered OUTSIDE the link. */
  topRight?: ReactNode;
  className?: string;
};

/** `16/9` editorial canvas — calm (no scrim; caption flows under image). */
export function LotCardEditorialCalm({
  href,
  image,
  title,
  description,
  footer,
  topRight,
  className,
}: LotCardEditorialCalmProps) {
  return (
    <article
      className={cn(
        "group relative block overflow-hidden rounded-xl border border-border-hairline bg-surface-container-lowest shadow-sm",
        className,
      )}
    >
      <Link href={href} className="block">
        <div className="relative aspect-video bg-surface-container-low">
          <div className={cn("absolute inset-0", mediaHover)}>{image}</div>
        </div>
        <div className="space-y-2 p-6">
          {title}
          {description}
          {footer}
        </div>
      </Link>
      {topRight ? (
        <div className="pointer-events-auto absolute right-3 top-3 z-[2]">{topRight}</div>
      ) : null}
    </article>
  );
}

export const LotCard = {
  Grid: LotCardGrid,
  List: LotCardList,
  EditorialBold: LotCardEditorialBold,
  EditorialCalm: LotCardEditorialCalm,
  /** Home hero tile (image link + body) — same contract as `MarketingLotTile`. */
  HeroTile: MarketingLotTile,
} as const;
