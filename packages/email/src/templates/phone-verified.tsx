import { emailSubjects } from "@auction/branding";
import { SecurityNotice } from "../components/SecurityNotice.js";
import { TextBlock } from "../components/TextBlock.js";
import type { TemplateVarsByName } from "../types.js";

export const subject = emailSubjects.phoneVerified;

export default function PhoneVerifiedEmail({
  maskedPhone,
  ...vars
}: TemplateVarsByName["phone-verified"]) {
  return (
    <SecurityNotice
      {...vars}
      preview="A phone number was verified on your LAX Account."
      title="Phone number verified"
      details={[{ label: "Phone number", value: maskedPhone }]}
    >
      <TextBlock>
        A phone number was verified on your LAX Account. If you already had a number saved, this one
        replaces it.
      </TextBlock>
    </SecurityNotice>
  );
}
