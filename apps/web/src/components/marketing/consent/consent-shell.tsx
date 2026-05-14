"use client";

import { ConsentBar } from "@/components/marketing/consent/consent-bar";
import { ConsentPreferencesDialog } from "@/components/marketing/consent/consent-dialog";

/** Client bundle for cookie banner + preferences dialog (mounted from root layout). */
export function ConsentShell() {
  return (
    <>
      <ConsentBar />
      <ConsentPreferencesDialog />
    </>
  );
}
