"use client";

import { requestFlashClear } from "@/lib/flash/flash-clear.client";
import { useEffect } from "react";

/** Tells the server the message for this page has been shown, so a reload does not repeat it. */
export function FlashClear({ endpoint, path }: { endpoint: string; path: string }) {
  useEffect(() => {
    void requestFlashClear(endpoint, path);
  }, [endpoint, path]);

  return null;
}
