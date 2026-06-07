import { LegalUL } from "@/components/marketing/legal-page";
import { WIZARD_STEPS } from "@/lib/forms/submission/step-validation";
import { MARKETING_PROSE_LINK } from "@/lib/marketing/chrome";
import { SELL_PREREQUISITES, WIZARD_STEP_SUMMARIES } from "@/lib/marketing/sell-flow-copy";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@auction/ui/components/accordion";

/** Prerequisites and wizard preview — heading lives on parent `LegalH2`. */
export function SellPrepareSection() {
  return (
    <div className="space-y-6">
      <p>
        Gather the following before you sign in. Photo tips for watches and motor cars are in the{" "}
        <a href="#photos" className={MARKETING_PROSE_LINK}>
          photographing section
        </a>
        .
      </p>

      <LegalUL>
        {SELL_PREREQUISITES.map((item) => (
          <li key={item}>{item}</li>
        ))}
      </LegalUL>

      <div className="rounded-lg border border-border-hairline bg-surface-container-lowest p-4">
        <p className="font-body text-sm text-on-surface-variant">
          Preview the six steps in our submission wizard. Sign in when you are ready — your progress
          saves automatically.
        </p>
        <Accordion type="single" collapsible className="mt-4">
          {WIZARD_STEPS.map((step, index) => (
            <AccordionItem key={step.id} value={step.id}>
              <AccordionTrigger className="font-label text-xs uppercase tracking-[0.14em]">
                Step {index + 1} — {step.label}
              </AccordionTrigger>
              <AccordionContent className="font-body text-sm text-on-surface-variant">
                {WIZARD_STEP_SUMMARIES[step.id] ?? step.label}
              </AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
      </div>
    </div>
  );
}
