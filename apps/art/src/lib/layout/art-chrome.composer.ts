import {
  loadArtCrossProductFooterLinks,
  loadArtFamilyLinks,
  loadArtProductDirectoryLinks,
} from "@/lib/ecosystem/product-directory.server";
import { buildArtFooterVm } from "@/lib/layout/art-footer.vm";
import type { ArtFooterVm } from "@/lib/layout/art-footer.vm";
import { loadArtHeaderNav } from "@/lib/layout/art-header-nav.server";
import type { ArtHeaderNavData } from "@/lib/layout/art-nav.vm";
import { loadLinkableArtPolicies } from "@/lib/legal/art-policy-publication.server";
import type { LaxFamilyLinkVm, LaxProductLinkVm } from "@auction/lax-ecosystem";
import type { LaxArtPolicySlug } from "@auction/marketing-ui";

export type ArtChromeVm = {
  productLinks: LaxProductLinkVm[];
  /** The LAX top bar: the products, then LAX Account. */
  familyLinks: LaxFamilyLinkVm[];
  crossProductLinks: LaxProductLinkVm[];
  headerNav: ArtHeaderNavData | null;
  footer: ArtFooterVm;
  /** Policies that can be linked on this deployment. */
  linkablePolicies: LaxArtPolicySlug[];
};

/**
 * Root layout chrome: product directory, header mega-menu data and footer. Nothing here depends on
 * the visitor, so the layout's HTML can be shared between visitors; the account parts are read by
 * the browser (`/api/viewer`, ArtViewerChromeProvider).
 */
export async function composeArtChrome(): Promise<ArtChromeVm> {
  const productLinks = loadArtProductDirectoryLinks();
  const crossProductLinks = loadArtCrossProductFooterLinks();
  const headerNav = await loadArtHeaderNav();
  const linkablePolicies = loadLinkableArtPolicies();
  return {
    linkablePolicies,
    productLinks,
    familyLinks: loadArtFamilyLinks(),
    crossProductLinks,
    headerNav,
    footer: buildArtFooterVm({ crossProductLinks, linkablePolicies }),
  };
}
