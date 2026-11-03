import { AlertDigestGroup } from "../components/AlertDigestGroup.js";
import { Layout } from "../components/Layout.js";
import { TextBlock } from "../components/TextBlock.js";
import type { TemplateVarsByName } from "../types.js";

export const subject = (vars: TemplateVarsByName["alert-digest"]) => vars.subject;

export default function AlertDigestEmail({
  product,
  title,
  dateLabel,
  groups,
  reason,
  address,
  manageUrl,
  unsubscribeUrl,
  stopLabel,
  subject: subjectLine,
}: TemplateVarsByName["alert-digest"]) {
  return (
    <Layout
      category="auction"
      product={product}
      eyebrow={`Your alerts · ${dateLabel}`}
      preview={subjectLine}
      title={title}
      footerReason={address ? `${reason} This email was sent to ${address}.` : reason}
      unsubscribeUrl={unsubscribeUrl}
      unsubscribeLabel={stopLabel}
      {...(manageUrl ? { manage: { href: manageUrl, label: "Manage your alerts" } } : {})}
    >
      {groups.length === 0 ? <TextBlock>Nothing new today.</TextBlock> : null}
      {groups.map((group) => (
        <AlertDigestGroup key={group.heading} group={group} showHeading={groups.length > 1} />
      ))}
    </Layout>
  );
}
