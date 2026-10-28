"use client";

import { AccountChromeProvider } from "@/components/layout/account-switcher/account-chrome-context";
import { BidAccountSubNav } from "@/components/layout/bid-account-sub-nav";
import { ClientLayoutProvider } from "@/components/layout/client-layout-context";
import { DensityProvider } from "@/components/layout/density-provider";
import { ContextualKycReturnTracker } from "@/components/onboarding/buyer-onboarding-analytics";
import { type ActingContext, ViewerCapabilitiesProvider } from "@/lib/auth/capabilities";
import type { SessionUser } from "@/lib/data/contracts";
import type { AccountChrome } from "@/lib/navigation/account-switcher-model";
import type { ClientNavScope } from "@/lib/navigation/client-nav-model";
import type { DashboardDensity } from "@/lib/preferences/density";
import { ShellChromeProvider } from "@/lib/shell/shell-chrome-context";
import { AccountArea } from "@auction/marketing-ui";
import { TooltipProvider } from "@auction/ui/components/tooltip";
import type { ReactNode } from "react";

type Props = {
  user: SessionUser;
  navScope: ClientNavScope;
  account: AccountChrome;
  acting: ActingContext;
  cookieDensity: DashboardDensity | null;
  /** Account notices and failed loads, above the page. */
  banner?: ReactNode;
  children: ReactNode;
};

/**
 * A personal client's pages inside the public site: the "Your account" row under the public
 * header, then the page in the site's column. Pages read the frame from the layout context, so
 * the same page renders here or in an organisation workspace without knowing which.
 */
export function ClientWebsiteFrame({
  user,
  navScope,
  account,
  acting,
  cookieDensity,
  banner,
  children,
}: Props) {
  return (
    <ClientLayoutProvider layout="website">
      <ViewerCapabilitiesProvider user={user} acting={acting}>
        <ContextualKycReturnTracker kycApproved={user.kycStatus === "approved"} />
        <AccountChromeProvider account={account}>
          {/* Shared page parts (density toggles, mobile titles, tooltips) expect these. */}
          <ShellChromeProvider>
            <TooltipProvider delayDuration={200}>
              <DensityProvider cookieDensity={cookieDensity}>
                <AccountArea
                  subNav={
                    <BidAccountSubNav
                      userId={user.id}
                      scope={navScope}
                      initials={account.current.initials}
                    />
                  }
                  banner={banner}
                >
                  {children}
                </AccountArea>
              </DensityProvider>
            </TooltipProvider>
          </ShellChromeProvider>
        </AccountChromeProvider>
      </ViewerCapabilitiesProvider>
    </ClientLayoutProvider>
  );
}
