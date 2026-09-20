"use client";

import { useIsLg } from "./use-is-lg.js";

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
