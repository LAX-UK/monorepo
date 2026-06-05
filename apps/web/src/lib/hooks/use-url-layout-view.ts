"use client";

import {
  readMarketingViewParam,
  subscribeMarketingViewUrl,
} from "@/lib/preferences/view-url-store";
import { useSyncExternalStore } from "react";

/**
 * Live layout view from the URL query string.
 * Uses `history.replaceState` updates (see `useViewQueryNavigation`) so authenticated
 * sessions avoid dynamic RSC refetches that remount the page and reset scroll.
 */

export function useUrlLayoutView(defaultView: string, serverView: string): string {
  return useSyncExternalStore(
    subscribeMarketingViewUrl,
    () => readMarketingViewParam(defaultView, serverView),
    () => serverView,
  );
}
