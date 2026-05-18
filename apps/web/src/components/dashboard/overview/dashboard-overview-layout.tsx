import type { ReactNode } from "react";

export type DashboardOverviewSlots = {
  header: ReactNode;
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
  /** `focal` (v3): KPI hero → banner → attention → two-column bids/watchlist + activity feed → sell CTA.
   * `stack` / `twoCol` kept for compatibility.
   */
  layout?: "focal" | "stack" | "twoCol";
  slots: DashboardOverviewSlots;
};

export function DashboardOverviewLayout({ layout = "focal", slots }: Props) {
  if (layout === "focal") {
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
