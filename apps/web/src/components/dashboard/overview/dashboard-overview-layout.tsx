import type { ReactNode } from "react";

export type DashboardOverviewSlots = {
  header?: ReactNode;
  kpis: ReactNode;
  activity: ReactNode;
  watchlist: ReactNode;
  compliance?: ReactNode;
  attention?: ReactNode;
  banner?: ReactNode;
  activityFeed?: ReactNode;
  secondary?: ReactNode;
};

type Props = {
  slots: DashboardOverviewSlots;
};

/** Focal overview layout: compliance → KPI hero → bids/watchlist + activity feed → sell CTA. */
export function DashboardOverviewLayout({ slots }: Props) {
  return (
    <div className="screen flex w-full flex-col gap-6">
      {slots.header}
      {slots.compliance}
      {slots.kpis}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1.15fr)_minmax(280px,0.85fr)] lg:gap-8">
        <div className="flex flex-col gap-6">
          {slots.activity}
          {slots.watchlist}
        </div>
        {slots.activityFeed}
      </div>
      {slots.secondary}
    </div>
  );
}
