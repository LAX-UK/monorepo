import { Button } from "@auction/ui/components/button";

type Props = {
  onDismiss: () => void;
  onRebid: () => void;
  onUpdateAutoBid?: () => void;
};

export function LotOutbidBanner({ onDismiss, onRebid, onUpdateAutoBid }: Props) {
  return (
    <output
      className="mb-3 flex flex-col gap-3 rounded-md border border-error/30 bg-error-container/20 px-4 py-3 font-body text-sm text-on-surface ring-1 ring-error/20"
      aria-live="polite"
    >
      <p>
        <span className="font-label text-xs font-bold uppercase tracking-[var(--text-label-caps-tracking,0.22em)] text-error">
          You&apos;ve been outbid
        </span>
        <span className="mt-1 block text-on-surface-variant">
          Place a higher bid or raise your auto-bid max to retake the lead.
        </span>
      </p>
      <div className="flex flex-wrap gap-2">
        <Button type="button" size="sm" variant="default" onClick={onRebid}>
          Increase bid
        </Button>
        {onUpdateAutoBid ? (
          <Button type="button" size="sm" variant="outline" onClick={onUpdateAutoBid}>
            Raise max auto-bid
          </Button>
        ) : null}
        <Button type="button" size="sm" variant="ghost" onClick={onDismiss}>
          Dismiss
        </Button>
      </div>
    </output>
  );
}
