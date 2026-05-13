import { COLORS } from "@auction/branding";
import { Link } from "@react-email/components";
import { Layout } from "../components/Layout.js";
import { TextBlock } from "../components/TextBlock.js";
import type { TemplateVarsByName } from "../types.js";

export const subject = (vars: TemplateVarsByName["admin-impersonation-notice"]) =>
  `LAX support is reviewing your account (${vars.entityName})`;

export default function AdminImpersonationNoticeEmail(
  vars: TemplateVarsByName["admin-impersonation-notice"],
) {
  const {
    recipientFirstName,
    entityName,
    adminDisplayName,
    windowEndDisplay,
    supportContactEmail,
  } = vars;
  return (
    <Layout
      category="admin"
      eyebrow="Account review"
      preview={`London Art Exchange support is reviewing ${entityName}.`}
      title="Account review"
    >
      <TextBlock>Hi {recipientFirstName || "there"},</TextBlock>
      <TextBlock>
        {adminDisplayName} from London Art Exchange (LAX) support is reviewing your organisation
        account <strong>{entityName}</strong> as part of a support or investigation request.
      </TextBlock>
      <TextBlock>
        This access is time-limited and is expected to end by <strong>{windowEndDisplay}</strong>{" "}
        (within four hours from the start of the support session).
      </TextBlock>
      <TextBlock>
        If you have questions, please contact{" "}
        <Link
          href={`mailto:${supportContactEmail}`}
          style={{ color: COLORS.link, textDecoration: "underline" }}
        >
          {supportContactEmail}
        </Link>
        .
      </TextBlock>
    </Layout>
  );
}
