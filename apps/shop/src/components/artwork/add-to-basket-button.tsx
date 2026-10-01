"use client";

import { addArtworkToBasket, removeBasketLine } from "@/app/actions/basket.actions";
import { commerceErrorMessage } from "@/lib/commerce-error-message";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState, useTransition } from "react";

type Props = {
  slug: string;
  disabled?: boolean;
  inBasket?: boolean;
  basketLineId?: string | null;
};

export function AddToBasketButton({ slug, disabled, inBasket = false, basketLineId }: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [added, setAdded] = useState(inBasket);

  useEffect(() => {
    setAdded(inBasket);
  }, [inBasket]);

  return (
    <div className="shop-detail__purchase">
      {added ? (
        <div className="shop-detail__purchase-actions">
          <Link href="/basket" className="shop-detail__cta shop-focus-ring">
            View basket
          </Link>
          <button
            type="button"
            className="shop-detail__cta shop-detail__cta--secondary shop-focus-ring"
            disabled={pending}
            onClick={() => {
              if (!basketLineId) return;
              setError(null);
              startTransition(async () => {
                const result = await removeBasketLine(basketLineId);
                if (!result.ok) {
                  setError(commerceErrorMessage(result.error, "Could not update your basket."));
                  return;
                }
                setAdded(false);
                router.refresh();
              });
            }}
          >
            {pending ? "Updating…" : "Remove from basket"}
          </button>
        </div>
      ) : (
        <button
          type="button"
          className="shop-detail__cta shop-focus-ring"
          disabled={disabled || pending}
          onClick={() => {
            setError(null);
            startTransition(async () => {
              const result = await addArtworkToBasket(slug, 1);
              if (!result.ok) {
                setError(
                  commerceErrorMessage(
                    result.error,
                    "Could not add to basket. The edition may have sold out.",
                  ),
                );
                return;
              }
              setAdded(true);
              router.refresh();
            });
          }}
        >
          {pending ? "Adding…" : "Add to basket"}
        </button>
      )}
      {error ? (
        <p className="shop-detail__notice shop-detail__notice--alert" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}
