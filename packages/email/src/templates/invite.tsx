import { Button } from "../components/Button.js";
import { Layout } from "../components/Layout.js";
import { TextBlock } from "../components/TextBlock.js";
import type { TemplateVarsByName } from "../types.js";

export const subject = "You're invited to LAX Bid";

export default function InviteEmail({
  inviteUrl,
  inviterName,
  inviteeEmail,
  role,
  staffRole,
  expiresAt,
}: TemplateVarsByName["invite"]) {
  const roleLine =
    role === "staff" && staffRole
      ? ` as staff (${staffRole.replace(/_/g, " ")})`
      : role
        ? ` as ${role}`
        : "";
  return (
    <Layout
      category="account"
      eyebrow="Invitation"
      preview="Accept your LAX Bid invitation."
      title="You're invited"
    >
      <TextBlock>Hi {inviteeEmail},</TextBlock>
      <TextBlock>
        {inviterName || "The LAX Bid team"} invited you to join LAX Bid
        {roleLine}.
      </TextBlock>
      <Button href={inviteUrl}>Accept invitation</Button>
      {expiresAt ? <TextBlock>This invitation expires {expiresAt}.</TextBlock> : null}
    </Layout>
  );
}
