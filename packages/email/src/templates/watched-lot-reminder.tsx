import { Button } from "../components/Button.js";
import { FactCard } from "../components/FactCard.js";
import { Layout } from "../components/Layout.js";
import { TextBlock } from "../components/TextBlock.js";
import type { TemplateVarsByName } from "../types.js";

type Vars = TemplateVarsByName["watched-lot-reminder"];

const WHEN: Record<Vars["kind"], string> = {
  sale_start: "Bidding has opened",
  day_before_close: "It closes in about a day",
  hour_before_close: "It closes in about an hour",
};

export const subject = (vars: Vars) =>
  vars.kind === "sale_start"
    ? `Bidding has opened on ${vars.lotTitle}`
    : `${vars.lotTitle} closes soon`;

/**
 * The reminder a person set on a lot they watch, at the time they chose, with their own note.
 * Sent only while their "Lots you watch" email switch is on; the footer turns it off.
 */
export default function WatchedLotReminderEmail(vars: Vars) {
  const { userName, lotTitle, lotUrl, kind, note, closesAt, unsubscribeUrl } = vars;
  return (
    <Layout
      category="auction"
      eyebrow="Your reminder"
      preview={`${WHEN[kind]}: ${lotTitle}.`}
      title={`Reminder: ${lotTitle}`}
      unsubscribeUrl={unsubscribeUrl}
    >
      <TextBlock>Hi {userName || "there"},</TextBlock>
      <TextBlock>
        You asked us to remind you about <strong>{lotTitle}</strong>. {WHEN[kind]}.
      </TextBlock>
      <FactCard
        rows={[
          ...(closesAt ? [{ label: "Closes", value: closesAt }] : []),
          ...(note ? [{ label: "Your note", value: note }] : []),
        ]}
      />
      <Button href={lotUrl}>View the lot</Button>
    </Layout>
  );
}
