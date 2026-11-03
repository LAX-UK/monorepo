import { buyerDefaultCopy } from "../buyer-default-copy.js";
import { Button } from "../components/Button.js";
import { HelpBlock } from "../components/HelpBlock.js";
import { Layout } from "../components/Layout.js";
import { TextBlock } from "../components/TextBlock.js";
import type { TemplateVarsByName } from "../types.js";

export const subject = (vars: TemplateVarsByName["buyer-default-notice"]) =>
  buyerDefaultCopy(vars.audience, vars).title;

export default function BuyerDefaultNoticeEmail(vars: TemplateVarsByName["buyer-default-notice"]) {
  const copy = buyerDefaultCopy(vars.audience, vars);
  return (
    <Layout
      category="alert"
      eyebrow={vars.audience === "buyer" ? "Purchase cancelled" : "Sale update"}
      preview={copy.paragraphs[0] ?? copy.heading}
      title={copy.heading}
    >
      <TextBlock>Hi {vars.userName || "there"},</TextBlock>
      {copy.paragraphs.map((paragraph) => (
        <TextBlock key={paragraph}>{paragraph}</TextBlock>
      ))}
      <Button href={vars.actionUrl}>{vars.actionLabel}</Button>
      <HelpBlock email={vars.supportContactEmail} />
    </Layout>
  );
}
