import { MarketingCheckIcon } from "@auction/marketing-ui";
import { cn } from "@auction/ui";
import Link from "next/link";

const STEPS = ["Basket", "Details", "Payment", "Confirmation"] as const;

export type ShopCheckoutStep = (typeof STEPS)[number];

/** Steps a shopper can go back to from later ones. Payment happens on the secure payment page. */
const STEP_HREFS: Partial<Record<ShopCheckoutStep, string>> = {
  Basket: "/basket",
  Details: "/checkout",
};

type Props = {
  current: ShopCheckoutStep;
  className?: string;
};

/**
 * Where the shopper is between basket and confirmation: numbered steps, a tick for each one done,
 * and the current one marked with `aria-current="step"`. Done steps that can be revisited link
 * back, except from Confirmation, where the order is already placed.
 */
export function ShopCheckoutSteps({ current, className }: Props) {
  const currentIndex = STEPS.indexOf(current);
  const finished = current === "Confirmation";

  return (
    <nav aria-label="Checkout progress" className={cn("shop-checkout-steps", className)}>
      <ol className="shop-checkout-steps__list">
        {STEPS.map((step, index) => {
          const isCurrent = step === current;
          const isComplete = index < currentIndex;
          const href = isComplete && !finished ? STEP_HREFS[step] : undefined;
          const content = (
            <>
              <span className="shop-checkout-steps__marker" aria-hidden>
                {isComplete ? (
                  <MarketingCheckIcon className="shop-checkout-steps__check" strokeWidth={2.5} />
                ) : (
                  index + 1
                )}
              </span>
              <span className="shop-checkout-steps__label">
                {step}
                {isComplete ? <span className="sr-only"> (done)</span> : null}
              </span>
            </>
          );
          return (
            <li
              key={step}
              className={cn(
                "shop-checkout-steps__item",
                isCurrent && "is-current",
                isComplete && "is-complete",
              )}
              {...(isCurrent ? { "aria-current": "step" as const } : {})}
            >
              {href ? (
                <Link href={href} className="shop-checkout-steps__link shop-focus-ring">
                  {content}
                </Link>
              ) : (
                <span className="shop-checkout-steps__link">{content}</span>
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
