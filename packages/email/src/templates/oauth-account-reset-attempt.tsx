import { COLORS } from "@auction/branding";
import { Link } from "@react-email/components";
import { Button } from "../components/Button.js";
import { Layout } from "../components/Layout.js";
import { TextBlock } from "../components/TextBlock.js";
import type { TemplateVarsByName } from "../types.js";

const PROVIDER_LABEL: Record<"google" | "apple", string> = {
  google: "Google",
  apple: "Apple",
};

export function subject({ provider }: TemplateVarsByName["oauth-account-reset-attempt"]): string {
  return `Sign in with ${PROVIDER_LABEL[provider]} for your London Art Exchange account`;
}

export default function OAuthAccountResetAttempt({
  provider,
  signInUrl,
  settingsUrl,
  userEmail,
  userName,
}: TemplateVarsByName["oauth-account-reset-attempt"]) {
  const label = PROVIDER_LABEL[provider];
  return (
    <Layout
      category="account"
      eyebrow="Sign-in help"
      preview={`Your account uses ${label} to sign in.`}
      title={`Sign in with ${label}`}
    >
      <TextBlock>Hi {userName || userEmail},</TextBlock>
      <TextBlock>
        We received a request to reset the password for your London Art Exchange account, but this
        account was created using {label}. There is no password to reset — you can sign in directly
        with {label} below.
      </TextBlock>
      <Button href={signInUrl}>Sign in with {label}</Button>
      <TextBlock>
        Prefer to use a password instead? Once you are signed in you can add one under{" "}
        <Link href={settingsUrl} style={{ color: COLORS.link, textDecoration: "underline" }}>
          Account security
        </Link>{" "}
        in your settings, then sign in with either method.
      </TextBlock>
      <TextBlock>If you did not request this, you can safely ignore the email.</TextBlock>
    </Layout>
  );
}
