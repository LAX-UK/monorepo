import { Button } from "../components/Button.js";
import { Layout } from "../components/Layout.js";
import { TextBlock } from "../components/TextBlock.js";
import type { TemplateVarsByName } from "../types.js";

export const subject = "Welcome to London Art Exchange";

export default function WelcomeEmail({ userName }: TemplateVarsByName["welcome"]) {
  return (
    <Layout
      category="account"
      eyebrow="Welcome"
      preview="Your London Art Exchange account is ready."
      title="Welcome to LAX"
    >
      <TextBlock>Hi {userName || "there"},</TextBlock>
      <TextBlock>
        Your email is verified and your London Art Exchange account is ready to use.
      </TextBlock>
      <Button href="https://lax.bid/dashboard">Go to your dashboard</Button>
    </Layout>
  );
}
