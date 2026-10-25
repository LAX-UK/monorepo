import { loadArtEnv } from "@/env.server";
import { loadArtAccountChromeState } from "@/lib/ecosystem/art-account-chrome.server";
import {
  loadArtCrossProductFooterLinks,
  loadArtProductDirectoryLinks,
} from "@/lib/ecosystem/product-directory.server";
import { toArtFooterAccountState } from "@/lib/layout/art-footer-account-state";
import { buildArtFooterVm } from "@/lib/layout/art-footer.vm";
import type { ArtFooterVm } from "@/lib/layout/art-footer.vm";
import { loadArtHeaderNav } from "@/lib/layout/art-header-nav.server";
import type { ArtHeaderNavData } from "@/lib/layout/art-nav.vm";
import { loadLinkableArtPolicies } from "@/lib/legal/art-policy-publication.server";
import type { AccountChromeState, LaxProductLinkVm } from "@auction/lax-ecosystem";
import type { LaxArtPolicySlug } from "@auction/marketing-ui";

export type ArtChromeVm = {
  productLinks: LaxProductLinkVm[];
  crossProductLinks: LaxProductLinkVm[];
  account: AccountChromeState;
  headerNav: ArtHeaderNavData | null;
  footer: ArtFooterVm;
  /** Policies that can be linked on this deployment. */
  linkablePolicies: LaxArtPolicySlug[];
};

/** Root layout chrome — product directory, account, header mega-menu data and footer. */
export async function composeArtChrome(): Promise<ArtChromeVm> {
  const [account, productLinks, crossProductLinks, headerNav] = await Promise.all([
    loadArtAccountChromeState(),
    Promise.resolve(loadArtProductDirectoryLinks()),
    Promise.resolve(loadArtCrossProductFooterLinks()),
    loadArtHeaderNav(),
  ]);

  const linkablePolicies = loadLinkableArtPolicies();
  return {
    linkablePolicies,
    productLinks,
    crossProductLinks,
    account,
    headerNav,
    footer: buildArtFooterVm({
      crossProductLinks,
      accountState: toArtFooterAccountState(account),
      cookieSettings: Boolean(loadArtEnv().ART_GA_MEASUREMENT_ID),
      linkablePolicies,
    }),
  };
}
