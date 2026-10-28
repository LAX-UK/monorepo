import { Button } from "../components/Button.js";
import { HelpBlock } from "../components/HelpBlock.js";
import { Layout } from "../components/Layout.js";
import { TextBlock } from "../components/TextBlock.js";
import type { TemplateVarsByName } from "../types.js";

type MembershipEndedVars = TemplateVarsByName["organisation-membership-ended-notice"];

const KIND_WORDS: Record<"auto_bid" | "absentee", string> = {
  auto_bid: "automatic bid",
  absentee: "absentee bid",
};

export const membershipEndedSubject = (vars: MembershipEndedVars) =>
  `You're no longer a member of ${vars.entityName}`;

/**
 * Sent to someone an owner or admin removed from an organisation, listing the automatic bids
 * for it that stopped with the removal.
 */
export function OrganisationMembershipEndedNoticeEmail(vars: MembershipEndedVars) {
  const { recipientFirstName, entityName, bidUrl, supportContactEmail } = vars;
  const stopped = vars.stoppedBids ?? [];
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
        can no longer bid, sell or see its pages in LAX Bid. Bids you already placed for it stay in
        their sales.
      </TextBlock>
      {stopped.length > 0 ? (
        <TextBlock>
          These automatic bids you set up for {entityName} have stopped and will not bid again:{" "}
          {stopped.map((bid) => `${KIND_WORDS[bid.kind]} on "${bid.lotTitle}"`).join("; ")}.
        </TextBlock>
      ) : null}
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
