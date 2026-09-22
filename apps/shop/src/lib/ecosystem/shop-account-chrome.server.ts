import { loadShopViewerState } from "@/lib/shop-viewer-state.server";
import type { AccountChromeState } from "@auction/lax-ecosystem";

export async function loadShopAccountChromeState(): Promise<AccountChromeState> {
  return loadShopViewerState();
}
