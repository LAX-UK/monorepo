"use client";

import { MARKETING_PAGE_SHELL } from "@auction/branding";
import { cn } from "@auction/ui";
import Link from "next/link";
import { useEffect, useRef } from "react";
import {
  type AccountSubNavCount,
  accountSubNavCountText,
  visibleAccountSubNavCount,
} from "./account-sub-nav-count.js";

export type AccountSubNavItem = {
  id: string;
  label: string;
  href: string;
  /** Something due on that page (bids outbid, purchases to pay); nothing shows when absent. */
  count?: AccountSubNavCount | null;
};

export type AccountSubNavProps = {
  /** Names the band for everyone and leads it on wide screens ("Your account"). */
  label: string;
  /** The person's initials, shown beside the label on wide screens. */
  initials?: string;
  items: readonly AccountSubNavItem[];
  /** Id of the page in view; `null` when none of the links is current. */
  currentId: string | null;
  className?: string;
};

const COUNT_TONE: Record<AccountSubNavCount["tone"], string> = {
  danger: "bg-danger-container text-danger-on-surface",
  neutral: "bg-surface-container-high text-on-surface",
};

/** Scrolls the band sideways (never the page) so the current link is fully visible. */
function keepInView(scroller: HTMLElement, link: HTMLElement) {
  const start = link.offsetLeft - scroller.offsetLeft;
  const end = start + link.offsetWidth;
  const fade = 32;
  if (start < scroller.scrollLeft) {
    scroller.scrollLeft = Math.max(0, start - fade);
  } else if (end > scroller.scrollLeft + scroller.clientWidth) {
    scroller.scrollLeft = end - scroller.clientWidth + fade;
  }
}

/**
 * The account pages' own row under the public header: one text link per page, the current one
 * underlined in the product accent. It scrolls sideways on phones and keeps the current link in
 * view. Products adopt it once they have more than one account page.
 */
export function AccountSubNav({
  label,
  initials,
  items,
  currentId,
  className,
}: AccountSubNavProps) {
  const scrollerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const scroller = scrollerRef.current;
    if (!scroller || currentId === null) return;
    const link = [...scroller.querySelectorAll<HTMLElement>("[data-sub-nav-id]")].find(
      (candidate) => candidate.dataset.subNavId === currentId,
    );
    if (link) keepInView(scroller, link);
  }, [currentId]);

  return (
    <nav
      aria-label={label}
      className={cn(
        "border-b border-outline-variant/60 bg-[var(--color-page-bg,var(--color-surface))]",
        className,
      )}
    >
      <div
        className={cn(MARKETING_PAGE_SHELL, "flex h-12 items-stretch gap-6 max-md:px-0 md:h-13")}
      >
        <span
          aria-hidden
          className="hidden shrink-0 items-center gap-2 font-body text-[0.8125rem] text-on-surface-variant md:flex"
        >
          {initials ? (
            <span className="grid size-7 place-items-center rounded-full bg-surface-container-high font-label text-xs font-semibold text-on-surface">
              {initials}
            </span>
          ) : null}
          {label}
          <span className="ml-2 h-4 w-px bg-outline-variant" />
        </span>
        <div
          ref={scrollerRef}
          className={cn(
            "flex min-w-0 flex-1 items-stretch gap-1 overflow-x-auto [scrollbar-width:none] max-md:px-2 [&::-webkit-scrollbar]:hidden",
            "max-md:[mask-image:linear-gradient(90deg,#000_85%,transparent)]",
          )}
        >
          {items.map((item) => {
            const current = item.id === currentId;
            const count = visibleAccountSubNavCount(item.count);
            return (
              <Link
                key={item.id}
                href={item.href}
                data-sub-nav-id={item.id}
                aria-current={current ? "page" : undefined}
                className={cn(
                  "relative inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap px-2.5 font-body text-sm",
                  "after:absolute after:inset-x-2.5 after:-bottom-px after:h-0.5 after:rounded-full",
                  "motion-safe:transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:-outline-offset-4 focus-visible:outline-ring",
                  current
                    ? "font-medium text-on-surface after:bg-[var(--color-product-accent,currentColor)]"
                    : "text-on-surface-variant hover:text-on-surface hover:after:bg-outline-variant",
                )}
              >
                {item.label}
                {count ? (
                  <span
                    className={cn(
                      "inline-grid h-[1.125rem] min-w-[1.125rem] place-items-center rounded-full px-1.5 font-body text-xs font-semibold leading-none",
                      COUNT_TONE[count.tone],
                    )}
                  >
                    <span aria-hidden>{accountSubNavCountText(count.value)}</span>
                    <span className="sr-only">, {count.label}</span>
                  </span>
                ) : null}
              </Link>
            );
          })}
        </div>
      </div>
    </nav>
  );
}
