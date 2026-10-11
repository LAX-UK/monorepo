import { ArtHeaderClient } from "@/components/header/art-header.client";
import { loadArtAccountChromeState } from "@/lib/ecosystem/art-account-chrome.server";
import { loadArtProductDirectoryLinks } from "@/lib/ecosystem/product-directory.server";

export async function ArtHeader() {
  const [account, productLinks] = await Promise.all([
    loadArtAccountChromeState(),
    Promise.resolve(loadArtProductDirectoryLinks()),
  ]);

  return <ArtHeaderClient account={account} productLinks={productLinks} />;
}
