"use client";

import { useBidAttention } from "@/hooks/use-bid-attention";
import type { AttentionChip } from "@/lib/navigation/client-attention";
import { MarketingAttentionStrip, type MarketingAttentionTone } from "@auction/marketing-ui";
import { cn } from "@auction/ui";

const TONE: Record<AttentionChip["kind"], MarketingAttentionTone> = {
  outbid: "danger",
  "payment-due": "warning",
  "account-in-review": "info",
};

/** The action the strip adds on a phone, where there is room for it. */
const STRIP_ACTION: Record<AttentionChip["kind"], string> = {
  outbid: "Bid again",
  "payment-due": "Pay now",
  "account-in-review": "See why",
};

type Placement = "bar" | "strip";

/**
 * The header's one urgent prompt for a signed-in client: outbid while a sale is live, else
 * account in review or a payment due. It is the inline chip in the header row from 640px, and
 * (`placement="strip"`) the 44px strip under the phone bar below 640px. Nothing shows when
 * nothing is pressing, and staff never see it.
 */
export function BidAttentionPrompt({ placement }: { placement: Placement }) {
  const { chip } = useBidAttention();
  if (!chip) return null;
  return (
    // Each placement mounts both of the shared component's forms, so the wrapper keeps exactly
    // one visible: the strip below 640px, the chip from 640px.
    <div
      data-placement={placement}
      className={cn(placement === "strip" ? "sm:hidden" : "max-sm:hidden", "min-w-0")}
    >
      <MarketingAttentionStrip
        label={chip.label}
        actionLabel={STRIP_ACTION[chip.kind]}
        href={chip.href}
        tone={TONE[chip.kind]}
        accessibleName={chip.accessibleName}
      />
    </div>
  );
}
