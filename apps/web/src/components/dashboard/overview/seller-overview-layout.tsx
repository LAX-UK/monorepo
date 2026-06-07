import type { ReactNode } from "react";

export type SellerOverviewSlots = {
  /** Above-the-fold next action when the seller has an open task. */
  nextAction?: ReactNode;
  kpis: ReactNode;
  /** Upcoming sales + payout forecast; omitted when empty. */
  activity?: ReactNode;
  guides: ReactNode;
  secondary: ReactNode;
};

/** Full-width seller overview — avoids buyer 2-column grid that squeezes guide cards. */
export function SellerOverviewLayout({ slots }: { slots: SellerOverviewSlots }) {
  return (
    <div className="flex w-full flex-col gap-6">
      {slots.nextAction}
      {slots.kpis}
      {slots.activity}
      {slots.guides}
      {slots.secondary}
    </div>
  );
}
