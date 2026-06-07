import { LegalUL } from "@/components/marketing/legal-page";
import { SELL_DEPARTMENT_PHOTO_HINTS } from "@/lib/marketing/sell-departments";
import { SELL_PHOTO_TIPS } from "@/lib/marketing/sell-flow-copy";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@auction/ui/components/accordion";

/** Photo guidance body — heading lives on parent `LegalH2`. */
export function SellPhotosSection() {
  return (
    <div className="space-y-4">
      <p>
        Strong photos help specialists assess your object faster. Upload at least one image to
        submit; three or more is recommended.
      </p>

      <LegalUL>
        {SELL_PHOTO_TIPS.map((tip) => (
          <li key={tip}>{tip}</li>
        ))}
      </LegalUL>

      <Accordion type="single" collapsible>
        <AccordionItem value="watches">
          <AccordionTrigger className="font-label text-xs uppercase tracking-[0.14em]">
            Watches &amp; clocks
          </AccordionTrigger>
          <AccordionContent>
            <LegalUL>
              {(SELL_DEPARTMENT_PHOTO_HINTS["watches-clocks"] ?? []).map((tip) => (
                <li key={tip}>{tip}</li>
              ))}
            </LegalUL>
          </AccordionContent>
        </AccordionItem>
        <AccordionItem value="motor-cars">
          <AccordionTrigger className="font-label text-xs uppercase tracking-[0.14em]">
            Motor cars
          </AccordionTrigger>
          <AccordionContent>
            <LegalUL>
              {(SELL_DEPARTMENT_PHOTO_HINTS["motor-cars"] ?? []).map((tip) => (
                <li key={tip}>{tip}</li>
              ))}
            </LegalUL>
          </AccordionContent>
        </AccordionItem>
      </Accordion>
    </div>
  );
}
