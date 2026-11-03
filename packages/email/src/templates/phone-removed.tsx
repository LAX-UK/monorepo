import { emailSubjects } from "@auction/branding";
import { SecurityNotice } from "../components/SecurityNotice.js";
import { TextBlock } from "../components/TextBlock.js";
import type { TemplateVarsByName } from "../types.js";

export const subject = emailSubjects.phoneRemoved;

export default function PhoneRemovedEmail({
  maskedPhone,
  ...vars
}: TemplateVarsByName["phone-removed"]) {
  return (
    <SecurityNotice
      {...vars}
      preview="The phone number on your LAX Account was removed."
      title="Phone number removed"
      details={[{ label: "Phone number", value: maskedPhone }]}
    >
      <TextBlock>
        The phone number on your LAX Account was removed. You can add a number again at any time
        from Personal details.
      </TextBlock>
    </SecurityNotice>
  );
}
