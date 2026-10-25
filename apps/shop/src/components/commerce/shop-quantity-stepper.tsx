import { MarketingMinusIcon, MarketingPlusIcon } from "@auction/marketing-ui";
import { cn } from "@auction/ui";
import { useId } from "react";

type ShopQuantityStepperProps = {
  value: number;
  min?: number;
  max: number;
  /** What is being counted, for the buttons' names: "Decrease quantity of Warm Basket". */
  itemLabel: string;
  /** A stated rule under the control, such as "Limit 2 per order". Never a stock figure. */
  hint?: string | null;
  disabled?: boolean;
  onChange: (next: number) => void;
  className?: string;
};

/**
 * Quantity for a basket line: 44px minus and plus buttons around the value. The buttons stop at
 * `min` and `max`; the ceiling is not announced as a number, only the hint's rule is.
 */
export function ShopQuantityStepper({
  value,
  min = 1,
  max,
  itemLabel,
  hint,
  disabled = false,
  onChange,
  className,
}: ShopQuantityStepperProps) {
  const hintId = useId();
  const atMin = value <= min;
  const atMax = value >= max;

  return (
    <fieldset
      className={cn("shop-qty", className)}
      {...(hint ? { "aria-describedby": hintId } : {})}
    >
      <legend className="shop-qty__label">Quantity</legend>
      <div className="shop-qty__control">
        <button
          type="button"
          className="shop-qty__button shop-focus-ring"
          aria-label={`Decrease quantity of ${itemLabel}`}
          disabled={disabled || atMin}
          onClick={() => onChange(value - 1)}
        >
          <MarketingMinusIcon className="size-4" />
        </button>
        <output className="shop-qty__value" aria-live="polite" aria-atomic="true">
          {value}
        </output>
        <button
          type="button"
          className="shop-qty__button shop-focus-ring"
          aria-label={`Increase quantity of ${itemLabel}`}
          disabled={disabled || atMax}
          onClick={() => onChange(value + 1)}
        >
          <MarketingPlusIcon className="size-4" />
        </button>
      </div>
      {hint ? (
        <span id={hintId} className="shop-qty__hint">
          {hint}
        </span>
      ) : null}
    </fieldset>
  );
}
