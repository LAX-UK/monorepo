import { COLORS, FONT_STACK_BODY } from "@auction/branding";
import { Button } from "../components/Button.js";
import { FactCard } from "../components/FactCard.js";
import { Layout } from "../components/Layout.js";
import { TextBlock } from "../components/TextBlock.js";
import type { TemplateVarsByName } from "../types.js";
import { collectionContactLine } from "./collection-contact.js";

type Vars = TemplateVarsByName["collection-can-book"];

export const subject = ({ lots }: Vars) =>
  lots.length === 1 ? "You can book your collection" : "You can book a time to collect your lots";

const list = {
  color: COLORS.textPrimary,
  fontFamily: FONT_STACK_BODY,
  fontSize: "15px",
  lineHeight: "24px",
  margin: "0 0 14px",
  paddingLeft: "20px",
};

export default function CollectionCanBookEmail({
  userName,
  placeName,
  address,
  lots,
  bookUrl,
  contactEmail,
  contactPhone,
}: Vars) {
  const one = lots.length === 1;
  return (
    <Layout
      category="auction"
      eyebrow="Collection"
      preview={`Your ${one ? "lot is" : "lots are"} ready to book for collection.`}
      title={one ? "You can book your collection" : "You can book a time to collect your lots"}
    >
      <TextBlock>Hi {userName || "there"},</TextBlock>
      <TextBlock>
        {`${one ? "Your lot is paid for and ready to collect." : "Your lots are paid for and ready to collect."} Book a time to collect ${one ? "it" : "them"} from ${placeName}, and tell us who is coming.`}
      </TextBlock>
      <FactCard rows={[{ label: "Where", value: `${placeName}, ${address}` }]} />
      <ul style={list}>
        {lots.map((lot) => (
          <li key={lot}>{lot}</li>
        ))}
      </ul>
      <Button href={bookUrl}>Book a collection time</Button>
      <TextBlock>{collectionContactLine(contactEmail, contactPhone)}</TextBlock>
    </Layout>
  );
}
