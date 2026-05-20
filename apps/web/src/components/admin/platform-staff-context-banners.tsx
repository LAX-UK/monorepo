"use client";

import { StaleStaffSessionBanner } from "@/components/admin/stale-staff-session-banner";

/** Platform staff shell banners — rendered via `ShellConfig.contextBanner`. */
export function PlatformStaffContextBanners() {
  return <StaleStaffSessionBanner />;
}
