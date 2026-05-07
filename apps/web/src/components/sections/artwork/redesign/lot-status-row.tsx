import { LiveDot } from "@auction/ui";
import Link from "next/link";

type Props = {
  isLive: boolean;
  bidCount: number;
  saleHref: string | null;
  saleTitle: string | null;
};

/** Mockup-aligned status row that sits between the breadcrumb and the right
 * summary. Existing bid count rendering inside `LotInfoStack` is preserved.
 */
export function LotStatusRow({ isLive, bidCount, saleHref, saleTitle }: Props) {
  if (!isLive && bidCount === 0 && !saleTitle) return null;
  const bidsText = `${bidCount} ${bidCount === 1 ? "bid" : "bids"}`;
  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 font-label text-[11px] font-semibold uppercase tracking-[0.16em] text-on-surface-variant">
      {isLive ? (
        <span className="inline-flex items-center gap-1.5 text-error">
          <LiveDot className="live-dot-pulse h-1.5 w-1.5" />
          Live
        </span>
      ) : null}
      <span>{bidsText}</span>
      {saleHref && saleTitle ? (
        <>
          <span aria-hidden>{"\u00B7"}</span>
          <Link
            href={saleHref}
            className="max-w-[16rem] truncate text-on-surface underline-offset-4 hover:underline"
          >
            {saleTitle}
          </Link>
        </>
      ) : null}
    </div>
  );
}
