import { Button } from "@/components/ui/button";
import { formatMoney } from "@/lib/format-currency";

type Props = {
  amount: string;
  error: string | null;
  submitting: boolean;
  onCancel: () => void;
  onConfirm: () => void;
};

export function BidConfirmation({ amount, error, submitting, onCancel, onConfirm }: Props) {
  return (
    <div className="space-y-8">
      <div className="border-l-4 border-primary bg-surface-container-low p-6">
        <p className="mb-1 font-label text-xs uppercase tracking-widest text-secondary">
          Confirming your bid of
        </p>
        <p className="font-headline text-3xl text-primary">{formatMoney(amount)}</p>
        <p className="mt-4 font-label text-[10px] leading-relaxed text-on-surface-variant">
          By placing a bid you agree to the terms of sale. Authentication may be required for
          high-value lots.
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
