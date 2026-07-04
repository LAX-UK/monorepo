import { BodyText } from "@auction/ui";

export function AutoBidUnavailableCard() {
  return (
    <div className="rounded-lg border border-outline-variant/30 bg-surface-container-low/80 p-4">
      <p className="font-label text-xs font-bold uppercase tracking-[var(--text-label-caps-tracking,0.22em)] text-on-surface-variant">
        Auto-bid unavailable
      </p>
      <BodyText className="mt-2 text-sm text-on-surface-variant">
        The saleroom has disabled auto-bid on this lot. Place bids manually below.
      </BodyText>
    </div>
  );
}
