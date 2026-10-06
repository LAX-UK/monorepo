import { cn } from "@auction/ui";

const STEPS = ["Basket", "Details", "Payment", "Confirmation"] as const;

export type ShopCheckoutStep = (typeof STEPS)[number];

type Props = {
  current: ShopCheckoutStep;
  className?: string;
};

export function ShopCheckoutSteps({ current, className }: Props) {
  const currentIndex = STEPS.indexOf(current);

  return (
    <nav aria-label="Checkout progress" className={cn("shop-checkout-steps", className)}>
      <ol className="shop-checkout-steps__list">
        {STEPS.map((step, index) => {
          const isCurrent = step === current;
          const isComplete = index < currentIndex;
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
              <span className="shop-checkout-steps__label">{step}</span>
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
