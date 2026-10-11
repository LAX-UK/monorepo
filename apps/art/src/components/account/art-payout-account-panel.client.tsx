"use client";

import { createArtPayoutAccountSession } from "@/lib/art-payout-account-actions.server";
import { PayoutAccountPanel } from "@auction/shop-portal/react";
import type { PayoutAccountViewModel } from "@auction/shop-portal/vm";

type Props = {
  viewModel: PayoutAccountViewModel;
  publishableKey: string | null;
};

export function ArtPayoutAccountPanel({ viewModel, publishableKey }: Props) {
  return (
    <PayoutAccountPanel
      viewModel={viewModel}
      publishableKey={publishableKey}
      createPayoutAccountSession={createArtPayoutAccountSession}
    />
  );
}
