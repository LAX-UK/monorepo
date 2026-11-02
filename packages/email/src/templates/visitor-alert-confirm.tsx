import { Button } from "../components/Button.js";
import { Layout } from "../components/Layout.js";
import { TextBlock } from "../components/TextBlock.js";
import type { TemplateVarsByName } from "../types.js";

export const subject = "Confirm your LAX Bid sale alerts";

export default function VisitorAlertConfirmEmail({
  confirmUrl,
  expirationHours,
  unsubscribeUrl,
}: TemplateVarsByName["visitor-alert-confirm"]) {
  return (
    <Layout
      category="auction"
      eyebrow="Sale alerts"
      preview="Confirm to hear when LAX Bid announces new sales."
      title="Confirm your sale alerts"
      footerReason="You are receiving this because this address was entered on the LAX Bid sale alerts form. If it was not you, ignore this email and nothing will be sent."
      unsubscribeUrl={unsubscribeUrl}
      unsubscribeLabel="Never email this address about sale alerts"
    >
      <TextBlock>
        Confirm that you want an email when LAX Bid announces new sales. It is the only email we
        will send you about this.
      </TextBlock>
      <Button href={confirmUrl}>Confirm sale alerts</Button>
      <TextBlock>The link works for {expirationHours} hours.</TextBlock>
    </Layout>
  );
}
