import { ArtAccountPage } from "@/components/account/art-account-shell";
import { ArtPayoutAccountPanel } from "@/components/account/art-payout-account-panel.client";
import { ArtStatusState, ArtStatusStateLink } from "@/components/art-status-state";
import { composeArtAccountPayoutsPage } from "@/lib/account/account-page.composer";
import { artPrivatePageTitle } from "@/lib/art-private-page-metadata";
import { artServices } from "@/lib/art-services.server";

export const dynamic = "force-dynamic";
export const metadata = artPrivatePageTitle("Payouts");

export default async function ArtAccountPayoutsPage() {
  const result = await composeArtAccountPayoutsPage(artServices);
  return (
    <ArtAccountPage result={result} title="Payouts">
      {({ payouts }) => {
        switch (payouts.kind) {
          case "ok":
            return (
              <ArtPayoutAccountPanel
                viewModel={payouts.viewModel}
                publishableKey={payouts.publishableKey}
              />
            );
          case "sign_in":
            return (
              <ArtStatusState
                variant="error"
                title="Sign in again"
                description="Your session has ended. Sign in to manage payouts."
                actions={
                  <ArtStatusStateLink href={payouts.loginHref} priority="primary">
                    Sign in
                  </ArtStatusStateLink>
                }
              />
            );
          case "failed":
            return (
              <ArtStatusState
                variant="error"
                title="Payouts unavailable"
                description="We could not load your payout account. Try again later."
              />
            );
        }
      }}
    </ArtAccountPage>
  );
}
