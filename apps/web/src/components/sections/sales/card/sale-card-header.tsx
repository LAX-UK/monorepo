import { SaleTypeBadge } from "@/components/marketing/sale-type-badge";
import type { Sale } from "@auction/types";

type Props = {
  scheduleLead: string;
  scheduleRest: string;
  auctionTypeLine: string;
  deliveryMode?: Sale["deliveryMode"] | undefined;
  isLive?: boolean | undefined;
};

/** Schedule + auction type lines for browse rows (SRP). */
export function SaleCardHeader({
  scheduleLead,
  scheduleRest,
  auctionTypeLine,
  deliveryMode,
  isLive = false,
}: Props) {
  const cleanRest = scheduleRest.replace(/^(\s*\|\s*)+/, "");
  const segments = cleanRest
    .split("|")
    .map((s) => s.trim())
    .filter(Boolean);

  return (
    <div className="flex flex-col gap-3">
      {deliveryMode ? (
        <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1">
          <SaleTypeBadge deliveryMode={deliveryMode} size="sm" isLive={isLive} />
          {segments.map((segment) => (
            <div
              key={segment}
              className="flex min-h-[1.25em] items-center border-l border-on-surface-variant/20 pl-2.5"
            >
              <span className="font-body text-xs font-normal uppercase text-on-surface-variant sm:text-sm">
                {segment}
              </span>
            </div>
          ))}
        </div>
      ) : (
        <>
          <p className="font-body text-xs font-medium uppercase leading-snug text-on-surface-variant sm:text-sm">
            <span className="font-semibold text-on-surface">{scheduleLead}</span>
            <span className="hidden font-normal sm:inline">{scheduleRest}</span>
          </p>
          <span className="font-body text-xs font-normal uppercase leading-snug text-on-surface-variant sm:text-sm">
            {auctionTypeLine}
          </span>
        </>
      )}
    </div>
  );
}
