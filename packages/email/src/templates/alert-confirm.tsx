import { Button } from "../components/Button.js";
import { Layout } from "../components/Layout.js";
import { TextBlock } from "../components/TextBlock.js";
import type { TemplateVarsByName } from "../types.js";

export const subject = (vars: TemplateVarsByName["alert-confirm"]) => vars.subject;

export default function AlertConfirmEmail({
  product,
  title,
  intro,
  buttonLabel,
  confirmUrl,
  expirationHours,
  sourceName,
  unsubscribeUrl,
  stopLabel,
}: TemplateVarsByName["alert-confirm"]) {
  return (
    <Layout
      category="auction"
      product={product}
      eyebrow="Confirm your address"
      preview={intro}
      title={title}
      footerReason={`This address was entered on the ${sourceName}.`}
      unsubscribeUrl={unsubscribeUrl}
      unsubscribeLabel={stopLabel}
    >
      <TextBlock>{intro}</TextBlock>
      <Button href={confirmUrl}>{buttonLabel}</Button>
      <TextBlock>
        Press the button on the page that opens. The link works for {expirationHours} hours. If you
        didn't ask for this, ignore this email and nothing more will be sent.
      </TextBlock>
    </Layout>
  );
}
