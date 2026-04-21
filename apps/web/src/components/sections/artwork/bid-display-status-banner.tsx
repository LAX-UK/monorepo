export type BidDisplayStatus = { kind: "owner" } | { kind: "winning" } | null;

export function BidDisplayStatusBanner({ status }: { status: BidDisplayStatus }) {
  if (!status) return null;
  if (status.kind === "owner") {
    return (
      <output
        className="block rounded-lg border border-primary/35 bg-primary-container/15 px-4 py-3 font-body text-sm text-on-surface ring-1 ring-primary/25"
        aria-live="polite"
      >
        <span className="font-label text-xs font-bold uppercase tracking-widest text-primary">
          Your listing
        </span>
        <p className="mt-1 text-on-surface">
          You&apos;re the seller for this lot. Bidding is disabled; you can follow activity below.
        </p>
      </output>
    );
  }
  return (
    <output
      className="block rounded-lg border border-primary/35 bg-primary-container/15 px-4 py-3 font-body text-sm text-on-surface ring-1 ring-primary/25"
      aria-live="polite"
    >
      <span className="font-label text-xs font-bold uppercase tracking-widest text-primary">
        You&apos;re winning
      </span>
      <p className="mt-1 text-on-surface">Your bid is currently the high bid on this lot.</p>
    </output>
  );
}
