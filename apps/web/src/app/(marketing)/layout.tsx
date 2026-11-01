import { BidSiteChrome } from "@/components/layout/bid-site-chrome";
import { CommandPaletteLazy } from "@/components/layout/command-palette-lazy";
import { MarketingSmoothScroll } from "@/components/layout/marketing-smooth-scroll.client";
import { AuthRequiredToast } from "@/components/marketing/auth-required-toast";
import { MarketingLotQuickLookShell } from "@/components/marketing/lot-quick-look/marketing-lot-quick-look-shell";
import { MarketingPromptOrchestrator } from "@/components/marketing/marketing-prompt-orchestrator";
import { MarketingGlobalHotkeys } from "@/lib/hotkeys/marketing-global-hotkeys";
import { areMarketingPromptsEnabled } from "@/lib/marketing/prompts/rollout.server";
import { type ReactNode, Suspense } from "react";

export default async function MarketingLayout({ children }: { children: ReactNode }) {
  return (
    <MarketingSmoothScroll>
      <BidSiteChrome
        transparentPaths={["/"]}
        mainLandmark
        wrap={(content) => (
          <MarketingLotQuickLookShell>
            <CommandPaletteLazy variant="marketing" />
            <MarketingGlobalHotkeys />
            {content}
            <AuthRequiredToast />
          </MarketingLotQuickLookShell>
        )}
      >
        {children}
      </BidSiteChrome>
      <Suspense fallback={null}>
        <MarketingPromptOrchestrator enabled={areMarketingPromptsEnabled()} />
      </Suspense>
    </MarketingSmoothScroll>
  );
}
