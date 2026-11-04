"use client";

import { FlashClear } from "@/components/flash/flash-clear";
import { ADMIN_FLASH_CLEAR_ENDPOINT } from "@/lib/admin/flash/admin-flash";

/** Tells the server the staff message for this page has been shown. */
export function AdminFlashClear({ path }: { path: string }) {
  return <FlashClear endpoint={ADMIN_FLASH_CLEAR_ENDPOINT} path={path} />;
}
