"use client";

import { markPendingLotViewTransition } from "@/lib/lot-view-transition-pending";
import { withViewTransition } from "@/lib/view-transition-runtime";
import {
  LOT_TRANSITION_IMAGE_ATTR,
  LOT_TRANSITION_ROOT_ATTR,
  lotImageTransitionName,
} from "@/lib/view-transitions";

function resolveLotTransitionTarget(root: HTMLElement): HTMLElement {
  const image = root.querySelector(`[${LOT_TRANSITION_IMAGE_ATTR}]`);
  return image instanceof HTMLElement ? image : root;
}
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { ComponentProps, MouseEventHandler } from "react";

type Props = ComponentProps<typeof Link> & {
  lotId: string;
};

/**
 * Navigates to a lot page with a shared view-transition-name on the clicked tile
 * and the detail hero. Only the clicked tile is named — no duplicate-name conflicts.
 */
export function LotViewTransitionLink({ lotId, href, onClick, ...rest }: Props) {
  const router = useRouter();

  const handleClick: MouseEventHandler<HTMLAnchorElement> = (e) => {
    onClick?.(e);
    if (e.defaultPrevented) return;
    if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    if (rest.target === "_blank") return;

    const root = e.currentTarget.closest(`[${LOT_TRANSITION_ROOT_ATTR}]`);
    if (!(root instanceof HTMLElement)) return;

    markPendingLotViewTransition(lotId);
    resolveLotTransitionTarget(root).style.viewTransitionName = lotImageTransitionName(lotId);

    e.preventDefault();
    const target = typeof href === "string" ? href : String(href);
    withViewTransition(() => {
      router.push(target);
    });
  };

  return <Link href={href} {...rest} onClick={handleClick} />;
}
