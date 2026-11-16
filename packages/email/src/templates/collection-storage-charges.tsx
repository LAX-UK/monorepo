import { COLORS } from "@auction/branding";
import { Button } from "../components/Button.js";
import { FactCard } from "../components/FactCard.js";
import { Layout } from "../components/Layout.js";
import { TextBlock } from "../components/TextBlock.js";
import { storageChargesCopy } from "../storage-reminder-copy.js";
import type { TemplateVarsByName } from "../types.js";
import { collectionContactLine } from "./collection-contact.js";
import { StorageLotList } from "./storage-lot-list.js";

type Vars = TemplateVarsByName["collection-storage-charges"];

const copyOf = (vars: Vars) =>
  storageChargesCopy({
    kind: vars.kind,
    chargingOn: vars.chargingOn,
    collectByLabel: vars.collectByLabel,
    placeName: vars.placeName,
    lotCount: vars.lots.length,
  });

export const subject = (vars: Vars) => copyOf(vars).subject;

const link = { color: COLORS.textPrimary, textDecoration: "underline" };

/**
 * After the collect-by day: "Storage charges have started" the day after, then a running total
 * every 14 days, each work with its total from the domain formatter. While the place raises no
 * storage invoices, only the approved "storage charges may apply" wording and no figures.
 */
export default function CollectionStorageChargesEmail(vars: Vars) {
  const {
    userName,
    chargingOn,
    collectByLabel,
    placeName,
    address,
    lots,
    lotTotals,
    bookUrl,
    storagePolicyUrl,
    contactEmail,
    contactPhone,
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
      <StorageLotList lots={lots} notes={chargingOn ? lotTotals : []} />
      <Button href={bookUrl}>Book a collection time</Button>
      <TextBlock>
        Read the{" "}
        <a href={storagePolicyUrl} style={link}>
          storage policy
        </a>
        .
      </TextBlock>
      <TextBlock>{collectionContactLine(contactEmail, contactPhone)}</TextBlock>
    </Layout>
  );
}
