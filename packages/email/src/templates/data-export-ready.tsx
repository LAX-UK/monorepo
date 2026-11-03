import { COLORS, FONT_STACK_BODY, emailSubjects } from "@auction/branding";
import { Text } from "@react-email/components";
import { Button } from "../components/Button.js";
import { FactCard } from "../components/FactCard.js";
import { Layout } from "../components/Layout.js";
import { TextBlock } from "../components/TextBlock.js";
import type { TemplateVarsByName } from "../types.js";

export const subject = emailSubjects.dataExportReady;

/** Links to LAX Account only: the file itself is never in an email, and a download needs a recent sign-in. */
export default function DataExportReadyEmail({
  userName,
  dataExportUrl,
  expiresDisplay,
  retentionDays,
}: TemplateVarsByName["data-export-ready"]) {
  return (
    <Layout
      category="account"
      eyebrow="Privacy"
      header="account"
      preview={`Your data is ready to download until ${expiresDisplay}.`}
      title="Your data is ready"
    >
      <TextBlock>Hi {userName || "there"},</TextBlock>
      <TextBlock>
        The copy of your data you asked for is ready. Sign in to LAX Account to download it. For
        your security we ask you to confirm it is you first.
      </TextBlock>
      <FactCard rows={[{ label: "Available until", value: expiresDisplay }]} />
      <Button href={dataExportUrl}>Go to your data</Button>
      <Text style={subheading}>How long it stays</Text>
      <TextBlock>
        The copy stays available for {retentionDays} days and is then deleted. You can delete it
        yourself sooner from the same page, and ask for a new one at any time.
      </TextBlock>
      <TextBlock>
        If you did not ask for this, sign in and secure your account from the security page.
      </TextBlock>
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
