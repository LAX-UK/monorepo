"use client";

import { requestAdminFlashClear } from "@/lib/admin/flash/flash-clear.client";
import { useEffect } from "react";

/** Tells the server the message for this page has been shown, so a reload does not repeat it. */
export function AdminFlashClear({ path }: { path: string }) {
  useEffect(() => {
    void requestAdminFlashClear(path);
  }, [path]);

  return null;
}
