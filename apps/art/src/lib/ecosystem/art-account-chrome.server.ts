import { loadArtViewerState } from "@/lib/art-viewer-state.server";
import type { AccountChromeState } from "@auction/lax-ecosystem";

export async function loadArtAccountChromeState(): Promise<AccountChromeState> {
  return loadArtViewerState();
}
