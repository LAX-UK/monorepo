import { UserX } from "lucide-react";
import type { BidderRowVM } from "./view-models";

type Props = {
  bidders: BidderRowVM[];
  total: number;
};

/**
 * Server-rendered panel showing masked (privacy-preserving) bidder names.
 * API never exposes userId / email, so this component never has access to them.
 */
export function SaleroomBiddersPanel({ bidders, total }: Props) {
  if (total === 0) {
    return (
      <div className="flex flex-col items-center gap-3 py-16 text-center">
        <UserX className="text-4xl text-on-surface-variant" aria-hidden />
        <p className="font-headline text-lg text-on-surface">No bidders yet</p>
        <p className="max-w-md text-sm text-on-surface-variant">
          Registered bidders will appear here once bidding begins.
        </p>
      </div>
    );
  }

  return (
    <section aria-label="Registered bidders" className="flex flex-col gap-4">
      <header className="flex items-center justify-between">
        <h2 className="font-headline text-2xl text-on-surface">Registered bidders</h2>
        <p className="font-label text-xs uppercase tracking-widest text-on-surface-variant">
          {total} {total === 1 ? "bidder" : "bidders"}
        </p>
      </header>
      <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {bidders.map((bidder, idx) => (
          <li
            key={`${bidder.maskedName}-${idx}`}
            className="flex items-center gap-3 rounded-lg bg-surface-container-low/50 px-4 py-3 ring-1 ring-outline-variant/20"
          >
            <span
              className="grid h-10 w-10 place-items-center rounded-full bg-primary-container/40 font-headline text-base font-semibold text-on-primary-container"
              aria-hidden
            >
              {bidder.maskedName.charAt(0).toUpperCase()}
            </span>
            <div className="min-w-0">
              <p className="truncate font-headline text-sm text-on-surface">{bidder.maskedName}</p>
              <p className="font-label text-[0.65rem] uppercase tracking-widest text-on-surface-variant">
                Joined {bidder.joinedLabel}
              </p>
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}
