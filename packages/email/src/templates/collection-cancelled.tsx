import { Button } from "../components/Button.js";
import { FactCard } from "../components/FactCard.js";
import { Layout } from "../components/Layout.js";
import { TextBlock } from "../components/TextBlock.js";
import type { TemplateVarsByName } from "../types.js";

type Vars = TemplateVarsByName["collection-cancelled"];

export const subject = ({ dayLabel }: Vars) => `Collection cancelled: ${dayLabel}`;

const capitalised = (text: string) => `${text.charAt(0).toUpperCase()}${text.slice(1)}`;

/** Why the visit ended, in a sentence to the person reading. */
function whyItEnded({
  cancelledBy,
  reasonText,
  forCollector,
}: Pick<Vars, "cancelledBy" | "reasonText" | "forCollector">): string {
  if (forCollector) {
    return `${forCollector.bookerName}'s collection has been cancelled, so you don't need to come. The calendar entry is removed if your calendar supports it.`;
  }
  if (cancelledBy === "buyer") {
    return "The time has been released for someone else. Your lots stay with us, paid and safe, until you book again.";
  }
  if (cancelledBy === "gallery") {
    const reason = reasonText ? `${capitalised(reasonText)}. ` : "";
    return `${reason}We're sorry for the change. Your lots stay with us, paid and safe, and you can book another time.`;
  }
  return "The person who booked it has left this account, so the visit can't go ahead. The lots stay with us, safe, until a new time is booked.";
}

export default function CollectionCancelledEmail(vars: Vars) {
  const { userName, reference, dayLabel, lots, bookUrl } = vars;
  return (
    <Layout
      category="auction"
      eyebrow="Collection"
      preview={`Your collection on ${dayLabel} is cancelled.`}
      title={`Your collection on ${dayLabel} is cancelled`}
    >
      <TextBlock>Hi {userName || "there"},</TextBlock>
      <TextBlock>{whyItEnded(vars)}</TextBlock>
      <FactCard
        rows={[
          { label: "Day", value: dayLabel },
          { label: lots.length === 1 ? "Lot" : "Lots", value: lots.join("; ") },
          { label: "Reference", value: reference, mono: true },
        ]}
      />
      {vars.forCollector ? null : <Button href={bookUrl}>Book another time</Button>}
    </Layout>
  );
}
