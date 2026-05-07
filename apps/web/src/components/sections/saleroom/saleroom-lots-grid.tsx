import type { ReactNode } from "react";
import { SaleroomLotCard } from "./saleroom-lot-card";
import type { SaleLotCardVM } from "./view-models";

type Props = {
  lots: SaleLotCardVM[];
  /** OCP: callers render action slot per lot (Bid/Watch vs Results). */
  renderActions?: (lot: SaleLotCardVM) => ReactNode;
  emptyMessage?: string;
};

/** Pure layout: Figma 4-up at xl; 32px column gap, 49px row gap.
 */
export function SaleroomLotsGrid({
  lots,
  renderActions,
  emptyMessage = "No lots in this section yet.",
}: Props) {
  if (lots.length === 0) {
    return <p className="py-12 text-center text-on-surface-variant">{emptyMessage}</p>;
  }
  return (
    <ul className="grid list-none grid-cols-1 justify-items-stretch gap-x-7 gap-y-10 p-0 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
      {lots.map((lot) => (
        <li key={lot.id} className="flex min-w-0 justify-center sm:justify-start">
          <SaleroomLotCard lot={lot} actions={renderActions?.(lot)} />
        </li>
      ))}
    </ul>
  );
}
