import { Button } from "../components/Button.js";
import { FactCard } from "../components/FactCard.js";
import { Layout } from "../components/Layout.js";
import { TextBlock } from "../components/TextBlock.js";
import type { TemplateVarsByName } from "../types.js";

type Vars = TemplateVarsByName["access-invite"];

function destination(vars: Pick<Vars, "scope" | "orgName">): string {
  return vars.scope === "organisation" && vars.orgName
    ? `${vars.orgName} on London Art Exchange`
    : "the London Art Exchange team";
}

export function subject(vars: Vars): string {
  const target =
    vars.scope === "organisation" && vars.orgName ? vars.orgName : "London Art Exchange";
  return vars.existingAccount
    ? `You've been given access to ${target}`
    : `You're invited to join ${target}`;
}

export default function AccessInviteEmail(vars: Vars) {
  const { actionUrl, existingAccount, expiresAt, grants, inviteeEmail, inviterName } = vars;
  const who = inviterName || "The London Art Exchange team";
  return (
    <Layout
      category="account"
      eyebrow="Invitation"
      preview={`${who} invited you to join ${destination(vars)}.`}
      title={existingAccount ? "You have new access" : "You're invited"}
    >
      <TextBlock>Hi {inviteeEmail},</TextBlock>
      <TextBlock>
        {who} invited you to join {destination(vars)}. You'll have this access:
      </TextBlock>
      <FactCard
        rows={grants.map((g) => ({
          label: g.platform,
          value: g.summary ? `${g.role} — ${g.summary}` : g.role,
        }))}
      />
      <TextBlock>
        {existingAccount
          ? "Sign in with your existing LAX account to accept. You use the same account on every LAX platform."
          : "Create your LAX account with this email address to accept. One account works across every LAX platform."}
      </TextBlock>
      <Button href={actionUrl}>
        {existingAccount ? "Accept and sign in" : "Create account and accept"}
      </Button>
      {expiresAt ? <TextBlock>This invitation expires {expiresAt}.</TextBlock> : null}
    </Layout>
  );
}
