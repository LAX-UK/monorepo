import { consignmentAgreementViewModel } from "@/lib/seller/consignment-agreement-view";
import { KeyValueList, Notice, Section } from "@auction/staff-ui";
import type { ConsignmentAgreement } from "@auction/types";

type Props = {
  agreement: ConsignmentAgreement | null;
};

/**
 * Where the seller's consignment agreement stands, for staff about to catalogue the lot: waiting
 * for the seller (cataloguing is refused until they accept) or accepted, by whom and when.
 */
export function SubmissionAgreementStatus({ agreement }: Props) {
  if (!agreement) {
    return (
      <Notice tone="warning" title="Waiting for the seller">
        No consignment agreement is recorded for this submission yet, so the lot can't be
        catalogued.
      </Notice>
    );
  }
  const vm = consignmentAgreementViewModel(agreement);
  return (
    <Section title="Consignment agreement">
      {vm.accepted ? (
        <Notice tone="success" title="Accepted by the seller">
          {vm.accepted.by} accepted on {vm.accepted.on} · {vm.versionName}
        </Notice>
      ) : (
        <Notice tone="warning" title="Waiting for the seller">
          The lot can be catalogued once the seller accepts the agreement. Reminders go out 3 and 7
          days after the proposal.
        </Notice>
      )}
      <KeyValueList
        className="mt-3"
        items={vm.terms.map((term) => ({ label: term.label, value: term.value, numeric: true }))}
      />
    </Section>
  );
}
