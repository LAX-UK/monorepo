"use client";

import { removeBasketLine, setBasketLineQuantity } from "@/app/actions/basket.actions";
import { commerceErrorMessage } from "@/lib/commerce-error-message";
import { formatGbpPence } from "@/lib/presenters/shop-money.presenter";
import type { BasketView } from "@auction/shop-contracts";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

type Props = {
  basket: BasketView;
};

function errorMessage(error: unknown): string {
  return commerceErrorMessage(error, "Could not update your basket.");
}

function BasketLineThumbnail({ imageUrl }: { imageUrl: string | null }) {
  if (!imageUrl) {
    return <div className="shop-basket__thumb shop-basket__thumb--placeholder" aria-hidden />;
  }
  return (
    <div className="shop-basket__thumb">
      <Image src={imageUrl} alt="" width={72} height={72} sizes="72px" />
    </div>
  );
}

export function BasketLinesClient({ basket }: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState<string | null>(null);
  const [quantities, setQuantities] = useState<Record<string, number>>(() =>
    Object.fromEntries(basket.lines.map((line) => [line.lineId, line.quantity])),
  );

  function commitQuantity(
    lineId: string,
    artworkSlug: string,
    next: number,
    previous: number,
    maxQuantity: number,
  ) {
    if (!Number.isInteger(next) || next < 1 || next > maxQuantity || next === previous) return;
    setMessage(null);
    startTransition(async () => {
      const result = await setBasketLineQuantity(artworkSlug, next);
      if (!result.ok) {
        setQuantities((current) => ({ ...current, [lineId]: previous }));
        setMessage(errorMessage(result.error));
        return;
      }
      router.refresh();
    });
  }

  return (
    <>
      {message ? (
        <p className="shop-basket__alert" role="alert">
          {message}
        </p>
      ) : null}
      <ul className="shop-basket__lines">
        {basket.lines.map((line) => {
          const quantity = quantities[line.lineId] ?? line.quantity;
          const maxQuantity = Math.min(24, line.sellableCount);
          return (
            <li key={line.lineId} className="shop-basket__line">
              <BasketLineThumbnail imageUrl={line.imageUrl} />
              <div className="shop-basket__line-body">
                <p className="shop-basket__line-title">
                  <Link href={`/artworks/${line.artworkSlug}`}>{line.artworkTitle}</Link>
                </p>
                <p className="shop-basket__line-price">
                  {formatGbpPence(line.unitPricePence)} each
                </p>
                {line.priceChanged ? (
                  <p className="shop-basket__alert">Price updated — refresh before checkout.</p>
                ) : null}
                {line.outOfStock ? (
                  <p className="shop-basket__alert">This line exceeds available stock.</p>
                ) : null}
                <p className="shop-basket__line-total">
                  Line total {formatGbpPence(line.unitPricePence * quantity)}
                </p>
                <div className="shop-basket__line-actions">
                  <div className="shop-basket__stepper">
                    <span className="shop-basket__qty-label">Qty</span>
                    <button
                      type="button"
                      className="shop-basket__stepper-btn shop-focus-ring"
                      disabled={pending || quantity <= 1}
                      aria-label={`Decrease quantity for ${line.artworkTitle}`}
                      onClick={() => {
                        const next = quantity - 1;
                        setQuantities((current) => ({ ...current, [line.lineId]: next }));
                        commitQuantity(line.lineId, line.artworkSlug, next, quantity, maxQuantity);
                      }}
                    >
                      −
                    </button>
                    <output className="shop-basket__stepper-value" aria-live="polite">
                      {quantity}
                    </output>
                    <button
                      type="button"
                      className="shop-basket__stepper-btn shop-focus-ring"
                      disabled={pending || quantity >= maxQuantity}
                      aria-label={`Increase quantity for ${line.artworkTitle}`}
                      onClick={() => {
                        const next = quantity + 1;
                        setQuantities((current) => ({ ...current, [line.lineId]: next }));
                        commitQuantity(line.lineId, line.artworkSlug, next, quantity, maxQuantity);
                      }}
                    >
                      +
                    </button>
                  </div>
                  <button
                    type="button"
                    className="shop-basket__remove shop-focus-ring"
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
          );
        })}
      </ul>
      <p className="shop-basket__total">
        Subtotal {formatGbpPence(basket.merchandiseSubtotalPence)}
      </p>
    </>
  );
}
