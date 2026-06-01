import type { ReactNode } from "react";

export type SellerOverviewSlots = {
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
      {slots.kpis}
      {slots.activity}
      {slots.guides}
      {slots.secondary}
    </div>
  );
}
