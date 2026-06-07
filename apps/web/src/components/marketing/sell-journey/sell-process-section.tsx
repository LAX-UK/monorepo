import { MARKETING_PROSE_LINK } from "@/lib/marketing/chrome";
import { SELL_JOURNEY_STEPS, SELL_PAGE_CONSIGNMENT_WORKS } from "@/lib/marketing/sell-flow-copy";

/** How-it-works body — heading lives on parent `LegalH2`. */
export function SellProcessSection() {
  return (
    <div className="space-y-4">
      <p>{SELL_PAGE_CONSIGNMENT_WORKS}</p>
      <p>
        From first enquiry to catalogue listing, the seller journey below takes about three minutes
        to submit.
      </p>
      <ol className="list-decimal space-y-3 pl-5">
        {SELL_JOURNEY_STEPS.map((step) => (
          <li key={step.id}>
            <span className="font-medium text-on-surface">{step.label}</span>
            {" — "}
            {step.description}
            {step.id === "discover" ? (
              <>
                {" "}
                See{" "}
                <a href="#departments" className={MARKETING_PROSE_LINK}>
                  what we accept
                </a>
                .
              </>
            ) : null}
          </li>
        ))}
      </ol>
    </div>
  );
}
