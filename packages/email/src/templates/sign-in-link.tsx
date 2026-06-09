import { Button } from "../components/Button.js";
import { Layout } from "../components/Layout.js";
import { TextBlock } from "../components/TextBlock.js";
import type { TemplateVarsByName } from "../types.js";

export const subject = "Your London Art Exchange sign-in link";

export default function SignInLink({
  signInUrl,
  userName,
  expirationMinutes,
}: TemplateVarsByName["sign-in-link"]) {
  return (
    <Layout
      category="account"
      eyebrow="Sign in"
      preview="Your secure sign-in link."
      title="Sign in to your account"
    >
      <TextBlock>Hi {userName || "there"},</TextBlock>
      <TextBlock>
        Click the button below to sign in to London Art Exchange. This link expires in{" "}
        {expirationMinutes} minutes and can only be used once.
      </TextBlock>
      <Button href={signInUrl}>Sign in</Button>
      <TextBlock>
        If the button does not work, copy and paste this link into your browser:
        <br />
        {signInUrl}
      </TextBlock>
      <TextBlock>If you did not request this, you can ignore it.</TextBlock>
    </Layout>
  );
}
