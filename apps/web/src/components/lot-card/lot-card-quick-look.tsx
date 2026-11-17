"use client";

import { useLotQuickLookOptional } from "@/components/marketing/lot-quick-look/lot-quick-look-context";
import { preloadLotQuickLookDialog } from "@/components/marketing/lot-quick-look/lot-quick-look-dialog.lazy";
import type {
  LotQuickLookOpenOptions,
  LotQuickLookVM,
} from "@/components/marketing/lot-quick-look/types";
import { usePrefersHover } from "@/hooks/use-prefers-hover";
import { LOT_CARD_COPY } from "@/lib/lot-card/lot-card-copy";
import { FOCUS_RING } from "@/lib/marketing/chrome";
import { cn } from "@auction/ui/lib/utils";
import { type MouseEvent, useRef } from "react";

type Props = {
  vm: LotQuickLookVM;
  options: LotQuickLookOpenOptions;
  className?: string;
};

/**
 * Quick look's trigger on a lot card: a quiet "Quick look" label at the bottom of the picture.
 * At rest it is invisible; it shows while the card is hovered with a mouse or while anything in the
 * card has keyboard focus (tabbing reaches it as an ordinary button). On a device without a fine
 * hovering pointer (phones, tablets) it is not drawn at all, so a tap on the card opens the lot
 * page. The card must be a `group` and the label's parent the positioned picture box.
 */
export function LotCardQuickLook({ vm, options, className }: Props) {
  const quickLook = useLotQuickLookOptional();
  const canHover = usePrefersHover();
  const ref = useRef<HTMLButtonElement>(null);
  if (!quickLook || !canHover) return null;

  function onClick(e: MouseEvent<HTMLButtonElement>) {
    e.preventDefault();
    e.stopPropagation();
    quickLook?.openQuickLook(vm, options, ref);
  }

  return (
    <button
      ref={ref}
      type="button"
      aria-label={LOT_CARD_COPY.quickLookAt(vm.title)}
      onClick={onClick}
      onPointerEnter={() => void preloadLotQuickLookDialog()}
      onFocus={() => void preloadLotQuickLookDialog()}
      className={cn(
        "absolute bottom-3 left-1/2 z-10 inline-flex -translate-x-1/2 rounded-full border border-outline-variant/30 bg-surface-container-lowest/95 px-3 py-1.5 font-label text-sm font-medium text-on-surface shadow-sm",
        "opacity-0 transition-opacity duration-[var(--lax-motion-hover)] focus-visible:opacity-100 group-focus-within:opacity-100 group-hover:opacity-100 motion-reduce:transition-none",
        FOCUS_RING,
        className,
      )}
    >
      {LOT_CARD_COPY.quickLook}
    </button>
  );
}
