import { Button } from "../components/Button.js";
import { FactCard } from "../components/FactCard.js";
import { HelpBlock } from "../components/HelpBlock.js";
import { Layout } from "../components/Layout.js";
import { TextBlock } from "../components/TextBlock.js";
import type { TemplateVarsByName } from "../types.js";

type RequestedVars = TemplateVarsByName["access-requested-notice"];
type DecidedVars = TemplateVarsByName["access-request-decided-notice"];
type ReminderVars = TemplateVarsByName["two-step-reminder-notice"];

export const accessRequestedSubject = (vars: RequestedVars) =>
  `${vars.requesterName} asked for access to ${vars.entityName}`;

/**
 * Sent to every owner and admin when a member asks for a role or more access. The request
 * waits for one of them, so it always arrives; it says what was asked for and why.
 */
export function AccessRequestedNoticeEmail(vars: RequestedVars) {
  const { recipientFirstName, requesterName, entityName, requested, reason, teamUrl } = vars;
  return (
    <Layout
      category="account"
      eyebrow="Access request"
      preview={`${requesterName} asked for ${requested}.`}
      title={`${requesterName} asked for access`}
    >
      <TextBlock>Hi {recipientFirstName || "there"},</TextBlock>
      <TextBlock>
        {requesterName} asked for {requested} at <strong>{entityName}</strong>. An owner or admin
        approves or declines it in Team.
      </TextBlock>
      <FactCard
        rows={[
          { label: "Asked for", value: requested },
          ...(reason ? [{ label: "Why", value: reason }] : []),
        ]}
      />
      <Button href={teamUrl}>Review the request</Button>
      <HelpBlock />
    </Layout>
  );
}

export const accessRequestDecidedSubject = (vars: DecidedVars) =>
  vars.approved
    ? `Your access request for ${vars.entityName} was approved`
    : `Your access request for ${vars.entityName} was declined`;

/** Sent to the member who asked, once an owner or admin decides. */
export function AccessRequestDecidedNoticeEmail(vars: DecidedVars) {
  const { recipientFirstName, entityName, approved, grantedRole, note, workspaceUrl } = vars;
  return (
    <Layout
      category="account"
      eyebrow="Access request"
      preview={
        approved
          ? `You now have the ${grantedRole ?? "new"} role at ${entityName}.`
          : `Your request for more access at ${entityName} was declined.`
      }
      title={approved ? "Your access request was approved" : "Your access request was declined"}
    >
      <TextBlock>Hi {recipientFirstName || "there"},</TextBlock>
      {approved ? (
        <TextBlock>
          You now have the {grantedRole ?? "new"} role at <strong>{entityName}</strong>. The pages
          it opens are ready the next time you switch to {entityName}.
        </TextBlock>
      ) : (
        <TextBlock>
          An owner or admin of <strong>{entityName}</strong> declined your request. If you need the
          access for your work, ask them directly.
        </TextBlock>
      )}
      {note ? <FactCard rows={[{ label: "Their note", value: note }]} /> : null}
      <Button href={workspaceUrl} tone="subtle">
        Open {entityName}
      </Button>
      <HelpBlock />
    </Layout>
  );
}

export const twoStepReminderSubject = (vars: ReminderVars) =>
  vars.required
    ? `Turn on two-step verification to keep acting for ${vars.entityName}`
    : `${vars.entityName} asks you to turn on two-step verification`;

/**
 * Sent by an owner or admin to members who don't have two-step verification on. It says why it
 * matters and where to turn it on; it changes nothing by itself.
 */
export function TwoStepReminderNoticeEmail(vars: ReminderVars) {
  const { recipientFirstName, entityName, senderName, required, securityUrl } = vars;
  return (
    <Layout
      category="account"
      eyebrow="Two-step verification"
      preview={`${senderName} asked you to turn on two-step verification for ${entityName}.`}
      title="Turn on two-step verification"
    >
      <TextBlock>Hi {recipientFirstName || "there"},</TextBlock>
      <TextBlock>
        {senderName} at <strong>{entityName}</strong> asked you to turn on two-step verification for
        your LAX Account. It adds a code from your phone when you sign in, so nobody else can bid,
        sell or see payouts in your name.
      </TextBlock>
      {required ? (
        <TextBlock>
          {entityName} requires it: until it's on, you'll be asked to set it up when you sign in,
          and you can't act for {entityName}.
        </TextBlock>
      ) : null}
      <TextBlock>It takes about two minutes.</TextBlock>
      <Button href={securityUrl}>Turn on two-step verification</Button>
      <HelpBlock />
    </Layout>
  );
}
