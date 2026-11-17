"use client";

import { LotViewTransitionLink } from "@/components/marketing/lot-view-transition-link";
import { FOCUS_WITHIN_RING } from "@/lib/marketing/chrome";
import { LOT_TRANSITION_IMAGE_ATTR, LOT_TRANSITION_ROOT_ATTR } from "@/lib/view-transitions";
import { cn } from "@auction/ui/lib/utils";
import Link from "next/link";
import type { ComponentProps, ReactNode } from "react";

type NavLinkProps = Pick<
  ComponentProps<typeof Link>,
  "href" | "className" | "children" | "aria-label" | "aria-hidden" | "tabIndex"
>;

function LotNavLink({ lotId, href, ...rest }: NavLinkProps & { lotId?: string | undefined }) {
  if (lotId != null) {
    return <LotViewTransitionLink lotId={lotId} href={href} {...rest} />;
  }
  return <Link href={href} {...rest} />;
}

export type LotListRowProps = {
  href: string;
  lotId?: string;
  image: ReactNode;
  title: ReactNode;
  subtitle?: ReactNode;
  footer?: ReactNode;
  trailing?: ReactNode;
  className?: string;
};

/**
 * A lot as a dense list row (search's list view): a square thumbnail, the title and the price.
 * Lot cards (grids) are `components/lot-card/lot-card.tsx`; this is the list layout.
 */
export function LotListRow({
  href,
  lotId,
  image,
  title,
  subtitle,
  footer,
  trailing,
  className,
}: LotListRowProps) {
  return (
    <article
      className={cn(
        "group relative flex gap-4 rounded-lg p-4 transition-colors hover:bg-surface-container-low/50 sm:gap-5 sm:p-5",
        FOCUS_WITHIN_RING,
        className,
      )}
      {...(lotId ? { [LOT_TRANSITION_ROOT_ATTR]: lotId } : {})}
    >
      <LotNavLink
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
          <LotNavLink lotId={lotId} href={href} className="min-w-0 block">
            {subtitle != null ? (
              <div className="min-w-0">
                {title}
                {subtitle}
              </div>
            ) : (
              title
            )}
          </LotNavLink>
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
