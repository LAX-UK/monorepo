"use client";

import type { BidPhoneMenuProps } from "@/components/layout/bid-phone-menu";
import { preloadWhenIdle } from "@/lib/ui/idle-preload";
import { type ComponentType, useEffect, useRef, useState } from "react";

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
  const { open, onOpenChange } = props;
  const onOpenChangeRef = useRef(onOpenChange);
  onOpenChangeRef.current = onOpenChange;
  const openFailures = useRef(0);

  useEffect(() => {
    if (!wanted) return;
    let current = true;
    const load = (fromTap: boolean) =>
      loadPhoneMenu().then(
        (component) => {
          openFailures.current = 0;
          if (current) setMenu(() => component);
        },
        () => {
          if (!fromTap || !current) return;
          // A tap that could not load the menu must not leave the header stuck "open". The
          // next tap tries again; if that fails too (a stale deploy, a lost connection), a
          // reload fetches a current page so the menu works again.
          openFailures.current += 1;
          if (openFailures.current >= 2) {
            openFailures.current = 0;
            window.location.reload();
            return;
          }
          onOpenChangeRef.current(false);
        },
      );
    if (open) {
      void load(true);
      // The menu is not there yet, so Escape is handled here until it mounts.
      const onKey = (event: KeyboardEvent) => {
        if (event.key === "Escape") onOpenChangeRef.current(false);
      };
      document.addEventListener("keydown", onKey);
      return () => {
        current = false;
        document.removeEventListener("keydown", onKey);
      };
    }
    const cancelIdle = preloadWhenIdle(() => void load(false));
    return () => {
      current = false;
      cancelIdle();
    };
  }, [wanted, open]);

  return Menu ? <Menu {...props} /> : null;
}
