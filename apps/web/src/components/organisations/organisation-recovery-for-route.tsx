"use client";

import { OrganisationRecoveryPanel } from "@/components/organisations/organisation-recovery-panel";
import {
  type OrganisationRecoveryView,
  organisationRecoveryForPage,
} from "@/lib/organisations/organisation-recovery.vm";
import { usePathname } from "next/navigation";

/**
 * The recovery in a layout shared by several tabs: on the Documents tab, which lists the same
 * documents in full, the checklist is left out.
 */
export function OrganisationRecoveryForRoute({ view }: { view: OrganisationRecoveryView }) {
  const pathname = usePathname();
  return <OrganisationRecoveryPanel view={organisationRecoveryForPage(view, pathname)} />;
}
