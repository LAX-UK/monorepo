import { Button } from "../components/Button.js";
import { Layout } from "../components/Layout.js";
import { TextBlock } from "../components/TextBlock.js";
import type { TemplateVarsByName } from "../types.js";

export const subject = "You're invited to London Art Exchange";

export default function InviteEmail({
  inviteUrl,
  inviterName,
  inviteeEmail,
  role,
  expiresAt,
}: TemplateVarsByName["invite"]) {
  return (
    <Layout preview="Accept your London Art Exchange invitation." title="You're invited">
      <TextBlock>Hi {inviteeEmail},</TextBlock>
      <TextBlock>
        {inviterName || "The London Art Exchange team"} invited you to join London Art Exchange
        {role ? ` as ${role}` : ""}.
      </TextBlock>
      <Button href={inviteUrl}>Accept invitation</Button>
      {expiresAt ? <TextBlock>This invitation expires {expiresAt}.</TextBlock> : null}
    </Layout>
  );
}
