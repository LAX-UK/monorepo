import { LotCardLotLine } from "@/components/lot-card/lot-card-lot-line";
import type { DepartmentDisplayStyle } from "@auction/domain";
import { lotCardMediaClasses } from "@auction/marketing-ui/lot-media/lot-card-media-frame";
import { cn } from "@auction/ui/lib/utils";
import Link from "next/link";
import type { ComponentType, ReactNode } from "react";

/** What the card hands the component that draws its two links (the picture and the title). */
export type LotCardLinkProps = {
  href: string;
  /** The lot, for a link that names a view transition (search). */
  lotId?: string | undefined;
  className?: string;
  children?: ReactNode;
  "aria-hidden"?: true;
  tabIndex?: number;
};

function PlainLink({ lotId: _lotId, ...props }: LotCardLinkProps) {
  return <Link {...props} />;
}

function PlainMediaBox({ className, children }: { className?: string; children: ReactNode }) {
  return <span className={className}>{children}</span>;
}

export type LotCardProps = {
  href: string;
  title: string;
  /** h3 inside a titled section (default), h2 on a listing page. */
  titleAs?: "h2" | "h3";
  /** "Lot 12": the line under the picture that carries the save heart. */
  lotLabel: string | null;
  /** How the lot's department shows its picture (one frame for every style: decision 4). */
  mediaStyle: DepartmentDisplayStyle;
  /** The picture: an image that fills its box. It is shown whole, centred on the mat. */
  media: ReactNode;
  /**
   * The box the picture fills, when a surface needs its own (the sale page and search sample the
   * picture's tones for the status pill: `AdaptiveMediaFrameContainer`). A plain box by default.
   */
  MediaBox?: ComponentType<{ className?: string; children: ReactNode }>;
  /** Draws the picture and title links; `next/link` by default. */
  LinkComponent?: ComponentType<LotCardLinkProps>;
  /** The lot, for the view transition attributes and a transition link. */
  lotId?: string;
  /** "Yours", over the top-left of the picture. Not interactive. */
  badge?: ReactNode;
  /**
   * The sale status pill (Sold, Unsold, In saleroom, Up next): with the badge, the only thing
   * that sits on the picture (decision 1). It places itself in the bottom-left corner
   * (`LOT_CARD_STATUS_CORNER`).
   */
  status?: ReactNode;
  /** Extra classes for the picture's frame, e.g. the "on the block" ring. */
  pictureClassName?: string;
  /** The save heart, at the right end of the "Lot N" line (decision 2). */
  save?: ReactNode;
  /** The quick look label (decision 3): shown over the picture on desktop hover and focus. */
  quickLook?: ReactNode;
  /** A line between the "Lot N" line and the title, e.g. "On the block". */
  flag?: ReactNode;
  /** Under the title: the artist, or year and medium. */
  subtitle?: ReactNode;
  /** Estimate, price and clock, the bidder's standing: pinned to the bottom of the card. */
  meta?: ReactNode;
  /** The full-width button: what the viewer can do next (decision 6). None when there is none. */
  action?: ReactNode;
  className?: string;
  /** Extra attributes on the card, e.g. the view transition root. */
  rootAttributes?: Readonly<Record<string, string | boolean>>;
  /** Extra attributes on the picture box, e.g. the view transition image. */
  mediaAttributes?: Readonly<Record<string, string | boolean>>;
};

/** Where the sale status pill sits on the picture: the same corner on every lot card. */
export const LOT_CARD_STATUS_CORNER =
  "pointer-events-none absolute bottom-3 left-3 z-[1] inline-flex max-w-[calc(100%-1.5rem)]";

/**
 * The lot card: the only one on Bid. The sale page, search (grid and card views), the home rails,
 * the artist page and the department grids all draw their lots with it, each supplying only the
 * data and the parts it has, so a lot looks and behaves the same wherever it appears.
 *
 * - The picture: shown whole on one mat (decision 4), a link to the lot with nothing on it at rest
 *   but the status pill and the owner badge (decision 1). It is not a tab stop: the title is the
 *   card's link for the keyboard and screen readers, so each card is read once.
 * - The "Lot N" line, with the save heart at its right end (decision 2).
 * - The title, then the quick look label: after the title in reading and tab order, drawn over
 *   the bottom of the picture by the card's grid (styles/lot-card.css), and only for a hovering
 *   fine pointer (decision 3).
 * - Meta (estimate, price line, bidder state) and the action slot, pinned to the bottom so prices
 *   and buttons line up across a row.
 *
 * No hooks: it renders on the server (home, artist, search) and inside the sale page's client grid.
 */
export function LotCard({
  href,
  title,
  titleAs: Title = "h3",
  lotLabel,
  mediaStyle,
  media,
  MediaBox = PlainMediaBox,
  LinkComponent = PlainLink,
  lotId,
  badge,
  status,
  pictureClassName,
  save,
  quickLook,
  flag,
  subtitle,
  meta,
  action,
  className,
  rootAttributes,
  mediaAttributes,
}: LotCardProps) {
  const frame = lotCardMediaClasses(mediaStyle);
  return (
    <article
      data-testid="lot-card"
      className={cn("lax-card lax-card-lift group lot-card h-full w-full min-w-0", className)}
      {...rootAttributes}
    >
      <div
        data-testid="lot-card-media"
        className={cn(
          "lot-card-picture lax-card-media relative w-full overflow-hidden rounded-lg",
          frame.frame,
          pictureClassName,
        )}
        data-media-style={mediaStyle}
        {...mediaAttributes}
      >
        <LinkComponent
          href={href}
          lotId={lotId}
          aria-hidden
          tabIndex={-1}
          className="absolute inset-0 block"
        >
          <MediaBox className="absolute inset-0 block">
            <span className={cn("block size-full", frame.inset)}>
              <span className={cn("relative block size-full", frame.image)}>{media}</span>
            </span>
          </MediaBox>
        </LinkComponent>
        {badge ? (
          <div className="pointer-events-none absolute left-3 top-3 z-[1]">{badge}</div>
        ) : null}
        {status}
      </div>

      <div className="lot-card-head flex min-w-0 flex-col gap-3">
        <LotCardLotLine label={lotLabel} save={save} />
        {flag}
        <div className="min-w-0">
          <Title className="m-0 line-clamp-2 font-body text-sm font-semibold leading-snug text-brand-900 md:text-lg md:leading-6 dark:text-on-surface">
            <LinkComponent
              href={href}
              lotId={lotId}
              className="lax-card-title rounded-sm underline-offset-4 hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
            >
              {title}
            </LinkComponent>
          </Title>
          {subtitle ? (
            <div className="mt-1 line-clamp-1 font-body text-sm leading-5 text-brand-500 dark:text-on-surface-variant">
              {subtitle}
            </div>
          ) : null}
        </div>
      </div>

      {quickLook}

      <div className="lot-card-foot flex min-w-0 flex-col gap-1.5">
        {meta}
        {action ? (
          <div data-testid="lot-card-action" className="mt-1 w-full min-w-0">
            {action}
          </div>
        ) : null}
      </div>
    </article>
  );
}
