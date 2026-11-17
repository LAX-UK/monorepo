"use client";

import { useLotQuickLookOptional } from "@/components/marketing/lot-quick-look/lot-quick-look-context";
import { preloadLotQuickLookDialog } from "@/components/marketing/lot-quick-look/lot-quick-look-dialog.lazy";
import type {
  LotQuickLookOpenOptions,
  LotQuickLookVM,
} from "@/components/marketing/lot-quick-look/types";
import { LOT_CARD_COPY } from "@/lib/lot-card/lot-card-copy";
import { FOCUS_RING } from "@/lib/marketing/chrome";
import { type MouseEvent, useRef } from "react";

type Props = {
  vm: LotQuickLookVM;
  options: LotQuickLookOpenOptions;
};

/**
 * Quick look's trigger on a lot card: a quiet "Quick look" label at the bottom of the picture, an
 * ordinary button. Its look and when it shows are in styles/lot-card.css: invisible at rest, shown
 * while the card is hovered with a mouse or holds keyboard focus, and not displayed at all without
 * a hovering fine pointer (phones, tablets), where a tap on the card opens the lot page. The card
 * must be a `group` and the label's parent the positioned picture box.
 */
export function LotCardQuickLook({ vm, options }: Props) {
  const quickLook = useLotQuickLookOptional();
  const ref = useRef<HTMLButtonElement>(null);
  if (!quickLook) return null;

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
      onPointerEnter={preloadLotQuickLookDialog}
      onFocus={preloadLotQuickLookDialog}
      className={`lot-card-quick-look ${FOCUS_RING}`}
    >
      {LOT_CARD_COPY.quickLook}
    </button>
  );
}
