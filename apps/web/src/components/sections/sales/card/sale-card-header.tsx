type Props = {
  scheduleLead: string;
  scheduleRest: string;
  auctionTypeLine: string;
};

/** Schedule + auction type lines for browse rows (SRP). */
export function SaleCardHeader({ scheduleLead, scheduleRest, auctionTypeLine }: Props) {
  return (
    <div className="flex flex-col gap-4">
      <p className="font-body text-xs font-medium uppercase leading-snug text-on-surface-variant sm:text-sm">
        <span className="font-semibold text-on-surface">{scheduleLead}</span>
        <span className="hidden font-normal sm:inline">{scheduleRest}</span>
      </p>
      <span className="font-body text-xs font-normal uppercase leading-snug text-on-surface-variant sm:text-sm">
        {auctionTypeLine}
      </span>
    </div>
  );
}
