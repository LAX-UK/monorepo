import { emailSubjects } from "@auction/branding";
import { Layout } from "../components/Layout.js";
import { TextBlock } from "../components/TextBlock.js";
import type { TemplateVarsByName } from "../types.js";

export const subject = emailSubjects.newDeviceLogin;

export default function NewDeviceLoginEmail({
  userName,
  whenDisplay,
  deviceSummary,
}: TemplateVarsByName["new-device-login"]) {
  return (
    <Layout
      category="account"
      eyebrow="Security"
      preview="We noticed a new sign-in to your account."
      title="New sign-in"
    >
      <TextBlock>Hi {userName || "there"},</TextBlock>
      <TextBlock>
        There was a new sign-in to your account{whenDisplay ? ` (${whenDisplay})` : ""}.
      </TextBlock>
      {deviceSummary ? <TextBlock>Device: {deviceSummary}</TextBlock> : null}
      <TextBlock>If this was you, you can ignore this message.</TextBlock>
    </Layout>
  );
}
