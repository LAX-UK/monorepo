import { COLORS, FONT_STACK_BODY, emailSubjects } from "@auction/branding";
import { Text } from "@react-email/components";
import { Button } from "../components/Button.js";
import { Layout } from "../components/Layout.js";
import { TextBlock } from "../components/TextBlock.js";
import type { TemplateVarsByName } from "../types.js";

export const subject = emailSubjects.accountDeletionHeld;

export default function AccountDeletionHeldEmail({
  userName,
  title,
  basis,
  reasonsIntro,
  reasons,
  recheck,
  resolution,
  cancelDeletionUrl,
}: TemplateVarsByName["account-deletion-held"]) {
  return (
    <Layout category="account" eyebrow="Security" header="account" preview={basis} title={title}>
      <TextBlock>Hi {userName || "there"},</TextBlock>
      <TextBlock>{basis}</TextBlock>
      <Text style={subheading}>{reasonsIntro}</Text>
      <ul style={list}>
        {reasons.map((reason) => (
          <li key={reason} style={item}>
            {reason}
          </li>
        ))}
      </ul>
      <TextBlock>{recheck}</TextBlock>
      <TextBlock>{resolution}</TextBlock>
      <Button href={cancelDeletionUrl}>Cancel deletion</Button>
    </Layout>
  );
}

const subheading = {
  color: COLORS.ink,
  fontFamily: FONT_STACK_BODY,
  fontSize: "16px",
  fontWeight: 700,
  lineHeight: "24px",
  margin: "20px 0 6px",
};

const list = {
  color: COLORS.ink,
  fontFamily: FONT_STACK_BODY,
  fontSize: "16px",
  lineHeight: "24px",
  margin: "0 0 16px",
  paddingLeft: "20px",
};

const item = { margin: "0 0 6px" };
