import {
  KeyValueList,
  Section,
  StaffDate,
  formatStaffDate,
  formatStaffMoney,
} from "@auction/staff-ui";
import type { StaffBuyerDefault, StaffReoffer } from "@auction/validators";

type Props = {
  buyerDefault: StaffBuyerDefault;
  /** The latest offer, whose shortfall staff read here; none before the first offer. */
  latestOffer: StaffReoffer | null;
};

/**
 * The facts of the void, kept on the rail: when it was recorded and by whom, the original sale,
 * the voided invoice, the reason, and what the default may be worth to LAX. The claimable amount
 * is for staff only and is recorded, never charged.
 */
export function BuyerDefaultCard({ buyerDefault, latestOffer }: Props) {
  const shortfall = latestOffer?.claimableShortfall ?? null;
  const invoice = buyerDefault.voidedInvoiceNumber;
  return (
    <Section title="Buyer default">
      <KeyValueList
        items={[
          {
            label: "Recorded",
            value: (
              <span className="flex flex-col">
                <StaffDate value={buyerDefault.recordedAt} withTime />
                {buyerDefault.recordedByName ? (
                  <span className="text-staff-xs text-staff-muted">
                    by {buyerDefault.recordedByName}
                  </span>
                ) : null}
              </span>
            ),
          },
          {
            label: "Original sale",
            value: (
              <span className="flex flex-col">
                {formatStaffMoney(buyerDefault.originalHammerMinor)} hammer
                <span className="text-staff-xs text-staff-muted">
                  Won {formatStaffDate(buyerDefault.wonAt)}
                </span>
              </span>
            ),
          },
          ...(invoice
            ? [
                {
                  label: "Voided invoice",
                  value: (
                    <span className="flex flex-col">
                      {invoice}
                      {buyerDefault.voidedInvoiceTotalMinor !== null ? (
                        <span className="text-staff-xs text-staff-muted">
                          {formatStaffMoney(buyerDefault.voidedInvoiceTotalMinor)}
                          {buyerDefault.voidedInvoiceDueAt
                            ? ` · was due ${formatStaffDate(buyerDefault.voidedInvoiceDueAt)}`
                            : ""}
                        </span>
                      ) : null}
                    </span>
                  ),
                },
              ]
            : []),
          { label: "Reason", value: buyerDefault.reason },
          {
            label: "Buyer's bidding",
            value: buyerDefault.buyerRestricted ? "Paused" : "Not paused",
          },
          ...(shortfall
            ? [
                {
                  label: "Claimable",
                  value: (
                    <span className="flex flex-col">
                      {formatStaffMoney(shortfall.totalMinor)}
                      <span className="text-staff-xs text-staff-muted">
                        {formatStaffMoney(shortfall.hammerDifferenceMinor)} shortfall +{" "}
                        {formatStaffMoney(shortfall.premiumLostMinor)} premium · not charged
                      </span>
                    </span>
                  ),
                },
              ]
            : []),
        ]}
      />
    </Section>
  );
}
