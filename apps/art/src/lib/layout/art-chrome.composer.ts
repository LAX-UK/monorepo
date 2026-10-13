import { loadArtEnv } from "@/env.server";
import { loadArtAccountChromeState } from "@/lib/ecosystem/art-account-chrome.server";
import {
  loadArtCrossProductFooterLinks,
  loadArtProductDirectoryLinks,
} from "@/lib/ecosystem/product-directory.server";
import { toArtFooterAccountState } from "@/lib/layout/art-footer-account-state";
import { buildArtFooterVm } from "@/lib/layout/art-footer.vm";
import type { ArtFooterVm } from "@/lib/layout/art-footer.vm";
import type { AccountChromeState, LaxProductLinkVm } from "@auction/lax-ecosystem";

export type ArtChromeVm = {
  productLinks: LaxProductLinkVm[];
  crossProductLinks: LaxProductLinkVm[];
  account: AccountChromeState;
  footer: ArtFooterVm;
};

/** Root layout chrome — product directory, account, and footer view models. */
export async function composeArtChrome(): Promise<ArtChromeVm> {
  const [account, productLinks, crossProductLinks] = await Promise.all([
    loadArtAccountChromeState(),
    Promise.resolve(loadArtProductDirectoryLinks()),
    Promise.resolve(loadArtCrossProductFooterLinks()),
  ]);

  return {
    productLinks,
    crossProductLinks,
    account,
    footer: buildArtFooterVm({
      crossProductLinks,
      accountState: toArtFooterAccountState(account),
      cookieSettings: Boolean(loadArtEnv().ART_GA_MEASUREMENT_ID),
    }),
  };
}
