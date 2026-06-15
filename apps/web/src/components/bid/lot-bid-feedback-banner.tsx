"use client";

import { BidErrorView } from "@/components/bid/bid-error-view";
import type { BidErrorPresentation } from "@/lib/ui/bid-error";
import { cn } from "@auction/ui";

type Props = {
  error: BidErrorPresentation | null;
  className?: string;
  onAction?: (actionKey: NonNullable<BidErrorPresentation["actionKey"]>) => void;
};

export function LotBidFeedbackBanner({ error, className, onAction }: Props) {
  if (!error) return null;
  return (
    <BidErrorView
      error={error}
      variant="banner"
      className={cn("mb-4", className)}
      {...(onAction ? { onAction } : {})}
    />
  );
}
