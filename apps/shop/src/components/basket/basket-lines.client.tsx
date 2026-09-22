"use client";

import { removeBasketLine, setBasketLineQuantity } from "@/app/actions/basket.actions";
import { commerceErrorMessage } from "@/lib/commerce-error-message";
import type { BasketView } from "@auction/shop-contracts";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

type Props = {
  basket: BasketView;
  formatGbp: (pence: number) => string;
};

function errorMessage(error: unknown): string {
  return commerceErrorMessage(error, "Could not update your basket.");
}

export function BasketLinesClient({ basket, formatGbp }: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState<string | null>(null);

  return (
    <>
      {message ? (
        <p className="shop-basket__alert" role="alert">
          {message}
        </p>
      ) : null}
      <ul className="shop-basket__lines">
        {basket.lines.map((line) => (
          <li key={line.lineId} className="shop-basket__line">
            <div>
              <Link href={`/artworks/${line.artworkSlug}`}>{line.artworkTitle}</Link>
              <p>{formatGbp(line.unitPricePence)} each</p>
              {line.priceChanged ? (
                <p className="shop-basket__alert">Price updated — refresh before checkout.</p>
              ) : null}
              {line.outOfStock ? (
                <p className="shop-basket__alert">This line exceeds available stock.</p>
              ) : null}
              <div className="shop-basket__line-actions">
                <label>
                  Qty
                  <input
                    type="number"
                    min={1}
                    max={24}
                    defaultValue={line.quantity}
                    disabled={pending}
                    onBlur={(event) => {
                      const next = Number.parseInt(event.target.value, 10);
                      if (!Number.isInteger(next) || next === line.quantity) return;
                      setMessage(null);
                      startTransition(async () => {
                        const result = await setBasketLineQuantity(line.artworkSlug, next);
                        if (!result.ok) {
                          setMessage(errorMessage(result.error));
                          return;
                        }
                        router.refresh();
                      });
                    }}
                  />
                </label>
                <button
                  type="button"
                  className="shop-focus-ring"
                  disabled={pending}
                  onClick={() => {
                    setMessage(null);
                    startTransition(async () => {
                      const result = await removeBasketLine(line.lineId);
                      if (!result.ok) {
                        setMessage(errorMessage(result.error));
                        return;
                      }
                      router.refresh();
                    });
                  }}
                >
                  Remove
                </button>
              </div>
            </div>
          </li>
        ))}
      </ul>
      <p className="shop-basket__total">Subtotal {formatGbp(basket.merchandiseSubtotalPence)}</p>
    </>
  );
}
