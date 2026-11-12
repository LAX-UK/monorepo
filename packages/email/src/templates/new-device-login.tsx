import { emailSubjects } from "@auction/branding";
import { SecurityNotice } from "../components/SecurityNotice.js";
import { TextBlock } from "../components/TextBlock.js";
import type { TemplateVarsByName } from "../types.js";

export const subject = emailSubjects.newDeviceLogin;

export default function NewDeviceLoginEmail(vars: TemplateVarsByName["new-device-login"]) {
  const { reviewDevicesUrl, ...notice } = vars;
  return (
    <SecurityNotice
      {...notice}
      review={
        reviewDevicesUrl
          ? {
              text: "Open your signed-in devices, sign out any you don't recognise, then change your password.",
              label: "Review where you're signed in",
              href: reviewDevicesUrl,
            }
          : undefined
      }
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
