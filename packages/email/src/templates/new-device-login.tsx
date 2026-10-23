import { emailSubjects } from "@auction/branding";
import { SecurityNotice } from "../components/SecurityNotice.js";
import { TextBlock } from "../components/TextBlock.js";
import type { TemplateVarsByName } from "../types.js";

export const subject = emailSubjects.newDeviceLogin;

export default function NewDeviceLoginEmail(vars: TemplateVarsByName["new-device-login"]) {
  return (
    <SecurityNotice
      {...vars}
      preview="Your LAX Account was signed in to from a device we haven't seen recently."
      title="New sign-in"
    >
      <TextBlock>
        Your LAX Account was signed in to from a browser or device we haven't seen on your account
        in the last 90 days.
      </TextBlock>
    </SecurityNotice>
  );
}
