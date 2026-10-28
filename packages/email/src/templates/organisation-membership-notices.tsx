import { Button } from "../components/Button.js";
import { HelpBlock } from "../components/HelpBlock.js";
import { Layout } from "../components/Layout.js";
import { TextBlock } from "../components/TextBlock.js";
import type { TemplateVarsByName } from "../types.js";

type MembershipEndedVars = TemplateVarsByName["organisation-membership-ended-notice"];
type BidCancelledVars = TemplateVarsByName["organisation-bid-cancelled-notice"];

export const membershipEndedSubject = (vars: MembershipEndedVars) =>
  `You're no longer a member of ${vars.entityName}`;

/** Sent to someone an owner or admin removed from an organisation. */
export function OrganisationMembershipEndedNoticeEmail(vars: MembershipEndedVars) {
  const { recipientFirstName, entityName, bidUrl, supportContactEmail } = vars;
  return (
    <Layout
      category="account"
      eyebrow="Organisation membership"
      preview={`You're no longer a member of ${entityName}.`}
      title={`You're no longer a member of ${entityName}`}
    >
      <TextBlock>Hi {recipientFirstName || "there"},</TextBlock>
      <TextBlock>
        An owner or admin of <strong>{entityName}</strong> removed you from the organisation, so you
        can no longer bid, sell or see its pages in LAX Bid. Bids you placed for it stay in their
        sales unless the organisation cancels them.
      </TextBlock>
      <TextBlock>
        Your personal account is unchanged: your own bids, purchases and consignments are where you
        left them.
      </TextBlock>
      <Button href={bidUrl} tone="subtle">
        Open LAX Bid
      </Button>
      <HelpBlock email={supportContactEmail} />
    </Layout>
  );
}

const BID_KIND_WORDS: Record<BidCancelledVars["bidKind"], string> = {
  auto_bid: "automatic bid",
  absentee: "absentee bid",
};

export const bidCancelledSubject = (vars: BidCancelledVars) =>
  `${vars.entityName} cancelled your bid for ${vars.lotTitle}`;

/** Sent to a former member when the organisation cancels a bid they placed for it. */
export function OrganisationBidCancelledNoticeEmail(vars: BidCancelledVars) {
  const { recipientFirstName, entityName, lotTitle, bidKind, supportContactEmail } = vars;
  const kind = BID_KIND_WORDS[bidKind];
  return (
    <Layout
      category="auction"
      eyebrow="Bid cancelled"
      preview={`${entityName} cancelled your ${kind} for ${lotTitle}.`}
      title="Your bid was cancelled"
    >
      <TextBlock>Hi {recipientFirstName || "there"},</TextBlock>
      <TextBlock>
        <strong>{entityName}</strong> cancelled the {kind} you placed for the organisation on{" "}
        <strong>{lotTitle}</strong>. It will not bid any further. Bids already placed in the sale
        are not affected.
      </TextBlock>
      <HelpBlock email={supportContactEmail} />
    </Layout>
  );
}
