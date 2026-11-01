import { MarketingPromoCta } from "@/components/marketing/marketing-promo-cta";
import { NewsletterSignupForm } from "@/components/sections/home/newsletter-signup-form";
import { MARKETING_PAGE_SHELL, MARKETING_PROSE_LINK } from "@/lib/marketing/chrome";
import { LabelCaps, cn } from "@auction/ui";
import Link from "next/link";

export function HomeNewsletter() {
  return (
    <section
      id="newsletter"
      aria-labelledby="newsletter-heading"
      className={cn(
        MARKETING_PAGE_SHELL,
        "border-t border-outline-variant bg-surface-container-low py-[var(--section-spacing)] text-center dark:bg-surface-container-lowest",
      )}
    >
      <div className="mx-auto flex max-w-[600px] flex-col items-center gap-7">
        <MarketingPromoCta
          as="div"
          headingId="newsletter-heading"
          className="w-full border-0 bg-transparent p-0 text-center shadow-none md:p-0"
          eyebrow={
            <div className="flex justify-center">
              <LabelCaps className="text-primary">LAX Private List</LabelCaps>
            </div>
          }
          title="Stay in the room."
          titleClassName="font-semibold leading-tight"
          description={
            <p className="font-body text-sm leading-7 text-on-surface-variant">
              Auction previews, artist features and early access — delivered before the gavel falls.
            </p>
          }
        >
          <NewsletterSignupForm />
        </MarketingPromoCta>
        <p className="font-footer-links text-xs leading-relaxed text-on-surface-variant">
          Unsubscribe any time. We respect your{" "}
          <Link href="/privacy" className={MARKETING_PROSE_LINK}>
            privacy
          </Link>
          .
        </p>
      </div>
    </section>
  );
}
