import { dealHoldLine } from "@/lib/admin/data-requests/deal-holds";
import type { DealHold } from "@/lib/data/http/admin-data-requests.reader";
import { KeyValueList, Section } from "@auction/staff-ui";

/**
 * The private sale deals that keep this person's enquiries and KYC evidence from erasure, each with
 * its reference and when the hold ends. Shown only for someone on a deal, so an erasure that holds
 * something can be explained to the person with the deal and the date.
 */
export function DealHoldsSection({ holds }: { holds: readonly DealHold[] }) {
  if (holds.length === 0) return null;
  return (
    <Section
      id="deal-holds"
      title="Kept for a private sale"
      description="The law requires the record of a sale to be kept after it ends"
    >
      <KeyValueList
        items={holds.map((hold) => {
          const line = dealHoldLine(hold);
          return { label: line.reference, value: line.text };
        })}
      />
    </Section>
  );
}
