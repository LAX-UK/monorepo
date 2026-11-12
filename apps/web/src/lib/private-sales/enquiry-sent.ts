import { LONDON_TIME_ZONE, formatWeekdayDate } from "@auction/datetime";
import type { EnquiryPath } from "./enquiry-values";

/** "Wednesday 4 November": the day the reply is promised, as a person in London reads it. */
export function replyByLabel(iso: string): string {
  // The weekday leads without a comma, however the runtime punctuates it.
  return formatWeekdayDate(new Date(iso), LONDON_TIME_ZONE, { year: false }).replace(",", "");
}

/** A step's first words are set in bold; the rest follows in running text. */
export type NextStep = { lead: string; rest: string };

type StepContext = { departmentLabel?: string | undefined; replyBy: string };

const STEPS: Record<EnquiryPath, (context: StepContext) => NextStep[]> = {
  sell: ({ departmentLabel, replyBy }) => [
    {
      lead: departmentLabel
        ? `A ${departmentLabel.toLowerCase()} specialist reads it`
        : "A specialist reads it",
      rest: ` and replies within two business days, by ${replyBy}.`,
    },
    {
      lead: "They may ask for more photos",
      rest: " or to see the work, and suggest a price range.",
    },
    {
      lead: "If you go ahead,",
      rest: " we agree the terms with you before we approach any buyer.",
    },
  ],
  buy: ({ replyBy }) => [
    {
      lead: "A specialist reads it",
      rest: ` and replies within two business days, by ${replyBy}.`,
    },
    {
      lead: "They may ask what you have in mind",
      rest: " and send details of works that could suit you.",
    },
    {
      lead: "If something interests you,",
      rest: " we agree the terms with you before we arrange anything.",
    },
  ],
};

export function nextSteps(path: EnquiryPath, context: StepContext): NextStep[] {
  return STEPS[path](context);
}
