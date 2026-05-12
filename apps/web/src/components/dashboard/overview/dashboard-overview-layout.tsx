import type { ReactNode } from "react";

export type DashboardOverviewSlots = {
  header: ReactNode;
  kpis: ReactNode;
  activity: ReactNode;
  watchlist: ReactNode;
  /** Persistent account-readiness strip; renders just under the header. */
  compliance?: ReactNode;
  /** Aggregated "needs attention" surface; renders just below KPIs. */
  attention?: ReactNode;
  banner?: ReactNode;
  /** Unified activity feed (notifications + derived events). */
  activityFeed?: ReactNode;
  secondary?: ReactNode;
};

type Props = {
  /** `stack` (mockup parity) renders KPIs -> active bids full-width -> banner ->
   * watchlist preview -> secondary action stack. `twoCol` (legacy default)
   * keeps the historical 1.2fr/0.8fr split for active-bids + watchlist and
   * mounts the secondary stack below the banner. Both layouts mount the same
   * children — only their positioning differs.
   */
  layout?: "stack" | "twoCol";
  slots: DashboardOverviewSlots;
};

export function DashboardOverviewLayout({ layout = "twoCol", slots }: Props) {
  if (layout === "stack") {
    return (
      <div className="screen flex w-full flex-col gap-8">
        {slots.header}
        {slots.compliance}
        {slots.banner}
        {slots.attention}
        {slots.kpis}
        {slots.activity}
        {slots.activityFeed}
        {slots.watchlist}
        {slots.secondary}
      </div>
    );
  }

  return (
    <div className="screen flex w-full flex-col gap-8">
      {slots.header}
      {slots.compliance}
      {slots.banner}
      {slots.attention}
      {slots.kpis}
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-[minmax(0,1.2fr)_minmax(280px,0.8fr)] xl:grid-cols-[minmax(0,1.2fr)_minmax(320px,0.8fr)]">
        {slots.activity}
        {slots.watchlist}
      </div>
      {slots.activityFeed}
      {slots.secondary}
    </div>
  );
}
