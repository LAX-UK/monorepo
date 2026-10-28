"use client";

import type { TermsFormValues } from "@/lib/admin/submissions/accept-proposal-form";
import { consignmentAgreementViewModel } from "@/lib/seller/consignment-agreement-view";
import { agreementTermsComplete } from "@auction/domain";
import { KeyValueList, Notice, Section } from "@auction/staff-ui";
import type { ConsignmentAgreement } from "@auction/types";
import type { UseFormReturn } from "react-hook-form";
import { SubmissionTermsForm } from "./submission-terms-form";

type Props = {
  agreement: ConsignmentAgreement | null;
  pending: boolean;
  onProposeTerms: (values: TermsFormValues, form: UseFormReturn<TermsFormValues>) => void;
};

/**
 * Where the seller's consignment agreement stands, for staff about to catalogue the lot: terms
 * still to add (the seller is never asked to accept blank terms), waiting for the seller
 * (cataloguing is refused until they accept), or accepted, by whom and when.
 */
export function SubmissionAgreementStatus({ agreement, pending, onProposeTerms }: Props) {
  if (!agreement || (!agreement.acceptedAt && !agreementTermsComplete(agreement))) {
    return (
      <Section title="Consignment agreement">
        <Notice tone="warning" title="Add the estimate and terms">
          The seller is asked to accept the agreement once it has an estimate and the seller's
          commission. The lot can be catalogued after they accept.
        </Notice>
        <div className="mt-4">
          <SubmissionTermsForm pending={pending} onSubmit={onProposeTerms} />
        </div>
      </Section>
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
