"use client";

export function PaymentsLoadFailedBlock() {
  return (
    <output className="block rounded-xl border border-warning/40 bg-warning-container/15 px-6 py-6 font-body text-sm text-on-surface">
      We could not confirm whether this lot is already paid. Refresh the page before attempting
      checkout again.
    </output>
  );
}
