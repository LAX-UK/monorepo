import { ArtEditorialLink } from "@/components/editorial/art-editorial-link";
import { InlineSpans } from "@/components/editorial/editorial-block-renderer";
import type { HowToBuyStep } from "@/lib/editorial/how-to-buy.vm";
import { MarketingStepCard } from "@auction/marketing-ui";
import Link from "next/link";

// The questions come from CMS copy and are not tied to Help centre entries, so they open the
// Help centre rather than guess an answer page; the closing help line goes to the team.
const FAQ_HREF = "/help";
const CONTACT_HREF = "/contact";

export function ArtHowToBuySteps({ steps }: { steps: readonly HowToBuyStep[] }) {
  return (
    <div className="flex flex-col gap-6">
      {steps.map((step, index) => (
        <MarketingStepCard
          key={step.title}
          data-testid="art-step-card"
          step={index + 1}
          title={step.title}
          linkAs={ArtEditorialLink}
          links={step.questions.map((label) => ({ label, href: FAQ_HREF }))}
          footer={
            <>
              Need further help?{" "}
              <Link
                href={CONTACT_HREF}
                className="art-focus-ring rounded-sm underline underline-offset-4"
              >
                Contact our team
              </Link>
            </>
          }
        >
          {step.paragraphs.map((spans, paragraph) => (
            // biome-ignore lint/suspicious/noArrayIndexKey: paragraphs are positional and never reordered.
            <p key={paragraph} className="m-0">
              <InlineSpans spans={spans} />
            </p>
          ))}
        </MarketingStepCard>
      ))}
    </div>
  );
}
