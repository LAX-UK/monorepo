import { Button } from "../components/Button.js";
import { Layout } from "../components/Layout.js";
import { TextBlock } from "../components/TextBlock.js";
import type { TemplateVarsByName } from "../types.js";

export const subject = "Confirm your LAX Shop release alerts";

export default function ShopReleaseAlertConfirmEmail({
  confirmUrl,
  expirationHours,
  unsubscribeUrl,
}: TemplateVarsByName["shop-release-alert-confirm"]) {
  return (
    <Layout
      category="auction"
      eyebrow="Release alerts"
      preview="Confirm to hear when LAX Shop releases a new edition."
      title="Confirm your release alerts"
      footerReason="You are receiving this because this address was entered on the LAX Shop release alerts form. If it was not you, ignore this email and nothing will be sent."
      unsubscribeUrl={unsubscribeUrl}
      unsubscribeLabel="Never email this address about release alerts"
    >
      <TextBlock>
        Confirm that you want an email each time LAX Shop releases a new edition. Until you do, we
        will not send you anything else.
      </TextBlock>
      <Button href={confirmUrl}>Confirm release alerts</Button>
      <TextBlock>The link works for {expirationHours} hours.</TextBlock>
    </Layout>
  );
}
