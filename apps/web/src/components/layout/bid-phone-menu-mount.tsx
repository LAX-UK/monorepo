"use client";

import type { BidPhoneMenuProps } from "@/components/layout/bid-phone-menu";
import { preloadWhenIdle } from "@/lib/ui/idle-preload";
import { type ComponentType, useEffect, useState } from "react";

type PhoneMenu = ComponentType<BidPhoneMenuProps>;

const loadPhoneMenu = (): Promise<PhoneMenu> =>
  import("@/components/layout/bid-phone-menu").then((mod) => mod.BidPhoneMenu);

/**
 * Brings the phone menu in on demand. Its code is not part of the page's first load: it is
 * fetched once the page is idle (so the first open is as fast as when it shipped with the page),
 * or at once if the menu is opened before that. The loaded menu is held in plain state rather than
 * behind a lazy component: a lazy component that suspends would swap the whole header for its
 * fallback and drop the open state. Once loaded it stays mounted, so it plays its closing motion
 * and opens again.
 */
export function BidPhoneMenuMount(props: BidPhoneMenuProps) {
  const [Menu, setMenu] = useState<PhoneMenu | null>(null);
  const wanted = Menu === null;

  useEffect(() => {
    if (!wanted) return;
    let current = true;
    const load = () =>
      void loadPhoneMenu().then((component) => {
        if (current) setMenu(() => component);
      });
    if (props.open) load();
    const cancelIdle = preloadWhenIdle(load);
    return () => {
      current = false;
      cancelIdle();
    };
  }, [wanted, props.open]);

  return Menu ? <Menu {...props} /> : null;
}
