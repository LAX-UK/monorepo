"use client";

import { OrganisationStateBanner } from "@/components/organisations/organisation-state-banner";
import type { OrganisationRecoveryView } from "@/lib/organisations/organisation-recovery.vm";
import {
  type OrganisationBannerView,
  organisationBannerForPage,
} from "@/lib/presenters/organisation-state/organisation-state-copy";
import { usePathname } from "next/navigation";

/**
 * The state banner in a layout shared by several tabs: on the tab its action leads to, the
 * line shows without the action.
 */
export function OrganisationStateBannerForRoute({
  banner,
  personal = null,
}: {
  banner: OrganisationBannerView;
  personal?: OrganisationRecoveryView["personal"];
}) {
  const pathname = usePathname();
  return (
    <OrganisationStateBanner
      banner={organisationBannerForPage(banner, pathname)}
      personal={personal}
    />
  );
}
