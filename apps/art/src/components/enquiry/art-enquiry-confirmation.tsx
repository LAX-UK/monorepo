import {
  type EnquiryConfirmationVm,
  enquiryConfirmationLead,
} from "@/lib/enquiry/enquiry-confirmation.vm";
import { MarketingEnquiryConfirmation } from "@auction/marketing-ui";
import { Button } from "@auction/ui/components/button";
import Link from "next/link";
import { type Ref, forwardRef } from "react";

export type ArtEnquiryConfirmationProps = {
  vm: EnquiryConfirmationVm;
  /** The address the form sent; the promise names it. */
  email: string | null;
  onClose: () => void;
};

/**
 * The sent state of both enquiry sheets: the promise, what happens next, the gallery's lines,
 * then tracking (signed in) or an account invitation (guest), and a way back to the page.
 */
export const ArtEnquiryConfirmation = forwardRef(function ArtEnquiryConfirmation(
  { vm, email, onClose }: ArtEnquiryConfirmationProps,
  ref: Ref<HTMLOutputElement>,
) {
  const { followUp } = vm;
  return (
    <MarketingEnquiryConfirmation
      ref={ref}
      data-testid="art-enquiry-confirmation"
      title={vm.title}
      lead={enquiryConfirmationLead(email)}
      steps={vm.steps}
      details={vm.details}
      actions={
        <>
          {followUp.kind === "account" ? (
            <p className="m-0 text-sm leading-6 text-on-surface-variant">{followUp.note}</p>
          ) : null}
          <Button asChild size="lg" className="min-h-11 w-full font-label">
            <Link href={followUp.href}>{followUp.label}</Link>
          </Button>
          <Button
            type="button"
            variant="secondaryOutline"
            size="lg"
            className="min-h-11 w-full font-label"
            onClick={onClose}
          >
            Continue browsing
          </Button>
        </>
      }
    />
  );
});
