import { emailSubjects } from "@auction/branding";
import { Layout } from "../components/Layout.js";
import { TextBlock } from "../components/TextBlock.js";
import type { TemplateVarsByName } from "../types.js";

export const subject = emailSubjects.accountDeletionCompleted;

export default function AccountDeletionCompletedEmail({
  erasedOnDisplay,
}: TemplateVarsByName["account-deletion-completed"]) {
  return (
    <Layout
      category="account"
      eyebrow="Security"
      header="account"
      preview={`Your LAX Account was deleted on ${erasedOnDisplay}.`}
      title="Your account was deleted"
    >
      <TextBlock>
        As you asked, we deleted your LAX Account on {erasedOnDisplay}. We erased your name, email
        address, phone number, saved addresses and sign-in details, and you are signed out of LAX
        Bid, LAX Shop and lax.art.
      </TextBlock>
      <TextBlock>
        We keep orders, invoices and payments without your personal details, because the law and our
        accounting rules require us to. This is the only message we'll send to this address about
        your account, and we haven't kept the address.
      </TextBlock>
      <TextBlock>You're always welcome to create a new account.</TextBlock>
    </Layout>
  );
}
