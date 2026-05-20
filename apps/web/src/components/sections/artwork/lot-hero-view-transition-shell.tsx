"use client";

import { consumePendingLotViewTransition } from "@/lib/lot-view-transition-pending";
import { lotImageTransitionStyle } from "@/lib/view-transitions";
import { cn } from "@auction/ui";
import { type CSSProperties, type ReactNode, useLayoutEffect, useState } from "react";

type Props = {
  lotId: string;
  className?: string;
  style?: CSSProperties;
  children: ReactNode;
};

/** Applies the lot hero view-transition-name when arriving from a marked tile click. */
export function LotHeroViewTransitionShell({
  lotId,
  className,
  style: styleProp,
  children,
}: Props) {
  const [transitionStyle, setTransitionStyle] = useState<CSSProperties | undefined>(undefined);

  useLayoutEffect(() => {
    const pending = consumePendingLotViewTransition();
    if (pending === lotId) {
      setTransitionStyle(lotImageTransitionStyle(lotId));
    }
  }, [lotId]);

  return (
    <div className={cn(className)} style={{ ...styleProp, ...transitionStyle }}>
      {children}
    </div>
  );
}
