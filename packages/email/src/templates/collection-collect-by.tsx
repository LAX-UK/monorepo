import { COLORS } from "@auction/branding";
import { Button } from "../components/Button.js";
import { FactCard } from "../components/FactCard.js";
import { Layout } from "../components/Layout.js";
import { TextBlock } from "../components/TextBlock.js";
import { collectByReminderCopy } from "../storage-reminder-copy.js";
import type { TemplateVarsByName } from "../types.js";
import { collectionContactLine } from "./collection-contact.js";
import { StorageLotList } from "./storage-lot-list.js";

type Vars = TemplateVarsByName["collection-collect-by"];

const copyOf = (vars: Vars) =>
  collectByReminderCopy({
    when: vars.when,
    collectByLabel: vars.collectByLabel,
    placeName: vars.placeName,
    lotCount: vars.lots.length,
    withRates: (vars.lotRates ?? []).some((rate) => Boolean(rate)),
  });

export const subject = (vars: Vars) => copyOf(vars).subject;

const link = { color: COLORS.textPrimary, textDecoration: "underline" };

export default function CollectionCollectByEmail(vars: Vars) {
  const {
    userName,
    collectByLabel,
    placeName,
    address,
    lots,
    lotRates,
    bookUrl,
    contactEmail,
    contactPhone,
    storagePolicyUrl,
    quoteUrl,
  } = vars;
  const copy = copyOf(vars);
  return (
    <Layout category="auction" eyebrow="Collection" preview={copy.preview} title={copy.title}>
      <TextBlock>Hi {userName || "there"},</TextBlock>
      {copy.paragraphs.map((paragraph) => (
        <TextBlock key={paragraph}>{paragraph}</TextBlock>
      ))}
      <FactCard
        rows={[
          { label: "Please collect by", value: collectByLabel },
          { label: "Where", value: `${placeName}, ${address}` },
        ]}
      />
      <StorageLotList lots={lots} notes={lotRates ?? []} />
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
      <TextBlock>{collectionContactLine(contactEmail, contactPhone)}</TextBlock>
    </Layout>
  );
}
