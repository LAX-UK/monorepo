"use client";

import { StaleStaffSessionBanner } from "@/components/admin/stale-staff-session-banner";
import { UploadValidationDevBanner } from "@/components/admin/upload-validation-dev-banner";

/** Platform staff shell banners — rendered via `ShellConfig.contextBanner`. */
export function PlatformStaffContextBanners() {
  return (
    <>
      <StaleStaffSessionBanner />
      <UploadValidationDevBanner />
    </>
  );
}
