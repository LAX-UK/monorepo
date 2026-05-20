"use client";

import { runPayoutSettlementAction } from "@/lib/admin/payout.actions";
import { Alert, AlertDescription, AlertTitle } from "@auction/ui/components/alert";
import { Button } from "@auction/ui/components/button";
import { Surface } from "@auction/ui/components/surface";
import Link from "next/link";

type Props = {
  open: boolean;
  error?: string | null;
  success?: string | null;
};

/** Inline settlement form shown when `/admin/payouts?settlement=1`. */
export function PayoutSettlementPanel({ open, error, success }: Props) {
  if (!open) return null;

  return (
    <Surface variant="card" className="border-border-hairline">
      <div className="space-y-4 p-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="font-heading text-lg">Run settlement</h2>
            <p className="mt-1 text-sm text-on-surface-variant">
              Create a payout from captured payments for one legal entity on demand.
            </p>
          </div>
          <Link
            href="/admin/payouts"
            className="font-label text-xs font-semibold uppercase tracking-[var(--text-label-caps-tracking,0.22em)] text-primary hover:underline"
          >
            Close
          </Link>
        </div>

        {success ? (
          <Alert>
            <AlertTitle>Done</AlertTitle>
            <AlertDescription>{success}</AlertDescription>
          </Alert>
        ) : null}
        {error ? (
          <Alert variant="destructive" role="alert">
            <AlertTitle>Settlement failed</AlertTitle>
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        ) : null}

        <p className="text-sm text-on-surface-variant">
          When the worker and API share <code className="text-xs">CRON_INTERNAL_SECRET</code>, a
          daily job also settles every eligible legal entity automatically.
        </p>
        <form action={runPayoutSettlementAction} className="space-y-3">
          <label className="block space-y-1 text-sm">
            <span className="font-medium">Legal entity ID</span>
            <input
              name="legalEntityId"
              required
              placeholder="00000000-0000-4000-8000-000000000000"
              className="w-full rounded-md border border-outline-variant bg-surface px-3 py-2"
            />
          </label>
          <Button type="submit">Run settlement</Button>
        </form>
      </div>
    </Surface>
  );
}
