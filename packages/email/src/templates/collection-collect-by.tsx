import { COLORS, FONT_STACK_BODY } from "@auction/branding";
import { Button } from "../components/Button.js";
import { FactCard } from "../components/FactCard.js";
import { Layout } from "../components/Layout.js";
import { TextBlock } from "../components/TextBlock.js";
import type { TemplateVarsByName } from "../types.js";

type Vars = TemplateVarsByName["collection-collect-by"];

export const subject = ({ when, collectByLabel }: Vars) =>
  when === "day" ? "Your free storage ends today" : `Please collect by ${collectByLabel}`;

const list = {
  color: COLORS.textPrimary,
  fontFamily: FONT_STACK_BODY,
  fontSize: "15px",
  lineHeight: "24px",
  margin: "0 0 14px",
  paddingLeft: "20px",
};

const link = { color: COLORS.textPrimary, textDecoration: "underline" };

export default function CollectionCollectByEmail({
  userName,
  when,
  collectByLabel,
  placeName,
  address,
  lots,
  bookUrl,
  storagePolicyUrl,
  quoteUrl,
}: Vars) {
  const today = when === "day";
  return (
    <Layout
      category="auction"
      eyebrow="Collection"
      preview={today ? "Your free storage ends today." : `Please collect by ${collectByLabel}.`}
      title={today ? "Your free storage ends today" : "Please collect within a week"}
    >
      <TextBlock>Hi {userName || "there"},</TextBlock>
      <TextBlock>
        {today
          ? `Today is the last day of free storage for your ${lots.length === 1 ? "lot" : "lots"} at ${placeName}. Book the next available time to come in. Storage charges may apply from tomorrow under our storage policy.`
          : `Your ${lots.length === 1 ? "lot stays" : "lots stay"} with us at ${placeName}. Please collect by ${collectByLabel}. After that, storage charges may apply under our storage policy.`}
      </TextBlock>
      <FactCard
        rows={[
          { label: "Please collect by", value: collectByLabel },
          { label: "Where", value: `${placeName}, ${address}` },
        ]}
      />
      <ul style={list}>
        {lots.map((lot) => (
          <li key={lot}>{lot}</li>
        ))}
      </ul>
      <Button href={bookUrl}>Book a collection time</Button>
      <TextBlock>
        Read the{" "}
        <a href={storagePolicyUrl} style={link}>
          storage policy
        </a>
        , or{" "}
        <a href={quoteUrl} style={link}>
          ask us for a courier quote
        </a>{" "}
        instead.
      </TextBlock>
    </Layout>
  );
}
