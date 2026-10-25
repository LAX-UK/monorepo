import { EMAIL_DASHBOARD_URL } from "@auction/branding";
import { Button } from "../components/Button.js";
import { Layout } from "../components/Layout.js";
import { TextBlock } from "../components/TextBlock.js";
import type { TemplateVarsByName } from "../types.js";

export const subject = "Welcome to LAX Account";

export default function WelcomeEmail({ userName }: TemplateVarsByName["welcome"]) {
  return (
    <Layout
      category="account"
      eyebrow="Welcome"
      preview="Your LAX Account is ready."
      title="Welcome to LAX"
    >
      <TextBlock>Hi {userName || "there"},</TextBlock>
      <TextBlock>Your email is verified and your LAX Account is ready to use.</TextBlock>
      <Button href={EMAIL_DASHBOARD_URL}>Go to your dashboard</Button>
    </Layout>
  );
}
