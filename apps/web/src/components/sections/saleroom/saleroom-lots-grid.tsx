import type { ReactNode } from "react";
import { SaleroomLotCard } from "./saleroom-lot-card";
import type { SaleLotCardVM } from "./view-models";

type Props = {
  lots: SaleLotCardVM[];
  /** OCP: callers render action slot per lot (Bid/Watch vs Results). */
  renderActions?: (lot: SaleLotCardVM) => ReactNode;
  emptyMessage?: string;
};

/**
 * Pure layout component. 4-col at lg, 2-col at sm, 1-col mobile — matches Figma.
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
    <ul className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
      {lots.map((lot) => (
        <li key={lot.id}>
          <SaleroomLotCard lot={lot} actions={renderActions?.(lot)} />
        </li>
      ))}
    </ul>
  );
}
