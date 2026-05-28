"use client";

import { useIsLg } from "@/hooks/use-is-lg";
import { useIsMd } from "@/hooks/use-is-md";
import { useIsSm } from "@/hooks/use-is-sm";

type OverlayRootProps = {
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
};

function buildRootProps(
  open: boolean | undefined,
  onOpenChange: ((open: boolean) => void) | undefined,
  active: boolean,
): OverlayRootProps {
  if (open === undefined) {
    return onOpenChange ? { onOpenChange } : {};
  }
  return {
    open: open && active,
    ...(onOpenChange ? { onOpenChange } : {}),
  };
}

/** Routes controlled `open` to mobile or desktop overlay root at `md` (768px). */
export function useSplitOverlayOpen(
  open: boolean | undefined,
  onOpenChange: ((open: boolean) => void) | undefined,
) {
  const isMd = useIsMd();
  return {
    mobile: buildRootProps(open, onOpenChange, !isMd),
    desktop: buildRootProps(open, onOpenChange, isMd),
    isMd,
  };
}

/** Routes controlled `open` to mobile or desktop overlay root at `lg` (1024px). */
export function useSplitOverlayOpenLg(
  open: boolean | undefined,
  onOpenChange: ((open: boolean) => void) | undefined,
) {
  const isLg = useIsLg();
  return {
    mobile: buildRootProps(open, onOpenChange, !isLg),
    desktop: buildRootProps(open, onOpenChange, isLg),
    isLg,
  };
}

/** Routes controlled `open` to mobile or desktop overlay root at `sm` (640px). */
export function useSplitOverlayOpenSm(
  open: boolean | undefined,
  onOpenChange: ((open: boolean) => void) | undefined,
) {
  const isSm = useIsSm();
  return {
    mobile: buildRootProps(open, onOpenChange, !isSm),
    desktop: buildRootProps(open, onOpenChange, isSm),
    isSm,
  };
}
