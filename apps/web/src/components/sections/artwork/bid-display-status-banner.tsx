import { formatMoney } from "@/lib/format-currency";

export type BidDisplayStatus = { kind: "owner" } | { kind: "winning" } | null;

type Props = {
  status: BidDisplayStatus;
  autoBidActive?: { max: string; step: string | null } | null;
};

export function BidDisplayStatusBanner({ status, autoBidActive = null }: Props) {
  if (!status) return null;
  if (status.kind === "owner") {
    return (
      <output
        className="block rounded-lg border border-primary/35 bg-primary-container/15 px-4 py-3 font-body text-sm text-on-surface ring-1 ring-primary/25"
        aria-live="polite"
      >
        <span className="font-label text-xs font-bold uppercase tracking-[var(--text-label-caps-tracking,0.22em)] text-primary">
          Your listing
        </span>
        <p className="mt-1 text-on-surface">
          You&apos;re the seller for this lot. Bidding is disabled; you can follow activity below.
        </p>
      </output>
    );
  }
  const autoLine =
    autoBidActive?.max != null && autoBidActive.max.trim() !== ""
      ? ` Auto-bid active to ${formatMoney(autoBidActive.max)}${
          autoBidActive.step ? ` (+${formatMoney(autoBidActive.step)} per raise)` : ""
        }.`
      : "";
  return (
    <output
      className="block rounded-lg border border-primary/35 bg-primary-container/15 px-4 py-3 font-body text-sm text-on-surface ring-1 ring-primary/25"
      aria-live="polite"
    >
      <span className="font-label text-xs font-bold uppercase tracking-[var(--text-label-caps-tracking,0.22em)] text-primary">
        You&apos;re winning
      </span>
      <p className="mt-1 text-on-surface">
        Your bid is currently the high bid on this lot.{autoLine}
      </p>
    </output>
  );
}
