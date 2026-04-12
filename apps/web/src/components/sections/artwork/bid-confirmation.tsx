import { Button } from "@/components/ui/button";
import { formatMoney } from "@/lib/format-currency";
import Link from "next/link";

type Props = {
  amount: string;
  maxAuto: string | null;
  error: string | null;
  submitting: boolean;
  onCancel: () => void;
  onConfirm: () => void;
};

export function BidConfirmation({
  amount,
  maxAuto,
  error,
  submitting,
  onCancel,
  onConfirm,
}: Props) {
  return (
    <div className="space-y-8">
      <div className="border-l-4 border-primary bg-surface-container-high/60 p-6 ring-1 ring-outline-variant/10">
        <p className="mb-1 font-label text-xs uppercase tracking-widest text-secondary">
          Confirming your bid of
        </p>
        <p className="font-headline text-3xl text-primary">{formatMoney(amount)}</p>
        {maxAuto ? (
          <p className="mt-4 font-body text-sm text-on-surface-variant">
            Max auto-bid cap:{" "}
            <span className="font-headline text-on-surface">{formatMoney(maxAuto)}</span>
          </p>
        ) : null}
        <p className="mt-4 font-label text-xs leading-relaxed text-on-surface-variant">
          By placing a bid you agree to the{" "}
          <Link href="/terms" className="text-primary underline-offset-2 hover:underline">
            terms of sale
          </Link>
          .
        </p>
      </div>
      {error ? (
        <p className="text-sm text-error" role="alert">
          {error}
        </p>
      ) : null}
      <div className="flex gap-4">
        <Button type="button" variant="secondary" className="flex-1 py-6" onClick={onCancel}>
          Cancel
        </Button>
        <Button
          type="button"
          variant="primary"
          className="flex-1 py-6"
          disabled={submitting}
          onClick={() => void onConfirm()}
        >
          {submitting ? "Submitting…" : "Place bid"}
        </Button>
      </div>
    </div>
  );
}
