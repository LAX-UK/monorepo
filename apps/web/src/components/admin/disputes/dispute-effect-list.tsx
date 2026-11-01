import type { AllocationEffects } from "@/lib/admin/finance/dispute-allocation";
import { formatStaffMoney } from "@auction/staff-ui";
import { Banknote, Scale } from "@auction/staff-ui/icons";

/**
 * What an allocation does to payouts, one line per seller and one for the house: the amount that
 * comes out of each seller's net share, and what the house bears. Shown before saving, in the
 * card and again in the confirm dialog.
 */
export function DisputeEffectList({
  effects,
  currency,
  fundsTaken,
}: {
  effects: AllocationEffects;
  currency: string;
  fundsTaken: boolean;
}) {
  if (effects.sellers.length === 0) return null;
  const money = (pence: number) => formatStaffMoney(pence, currency);
  return (
    <section aria-label="What this does to payouts" className="flex flex-col gap-2">
      <h3 className="text-staff-sm font-semibold text-staff-fg">What this does to payouts</h3>
      <ul className="flex flex-col divide-y divide-staff-line-subtle rounded-staff-lg border border-staff-line">
        {effects.sellers.map((seller) => (
          <li key={seller.sellerId} className="flex items-start gap-3 px-3 py-2.5">
            <Banknote aria-hidden className="mt-0.5 size-4 shrink-0 text-staff-muted" />
            <div className="min-w-0 flex-1">
              <p className="text-staff-sm font-medium text-staff-fg">{seller.sellerName}</p>
              <p className="text-staff-sm text-staff-muted">
                {fundsTaken
                  ? "Taken from the seller's payout when you save."
                  : "Taken from the seller's payout if Stripe withdraws the funds."}
              </p>
            </div>
            <p className="shrink-0 text-staff-sm font-medium tabular-nums text-staff-fg">
              {money(seller.sellerSharePence)}
            </p>
          </li>
        ))}
        <li className="flex items-start gap-3 px-3 py-2.5">
          <Scale aria-hidden className="mt-0.5 size-4 shrink-0 text-staff-muted" />
          <div className="min-w-0 flex-1">
            <p className="text-staff-sm font-medium text-staff-fg">House</p>
            <p className="text-staff-sm text-staff-muted">
              Bears its fee's part of the dispute, and any rounding.
            </p>
          </div>
          <p className="shrink-0 text-staff-sm font-medium tabular-nums text-staff-fg">
            {money(effects.houseSharePence)}
          </p>
        </li>
      </ul>
    </section>
  );
}
