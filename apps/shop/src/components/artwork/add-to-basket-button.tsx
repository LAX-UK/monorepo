"use client";

import { addArtworkToBasket, removeBasketLine } from "@/app/actions/basket.actions";
import { ShopCommerceButton } from "@/components/shop-commerce-button";
import { ShopNotice } from "@/components/shop-notice";
import { commerceErrorMessage } from "@/lib/commerce-error-message";
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
    <div className="shop-detail__purchase-actions">
      {added ? (
        <>
          <ShopCommerceButton href="/basket">View basket</ShopCommerceButton>
          <ShopCommerceButton
            type="button"
            variant="outline"
            disabled={pending || !basketLineId}
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
          </ShopCommerceButton>
        </>
      ) : (
        <ShopCommerceButton
          type="button"
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
        </ShopCommerceButton>
      )}
      {error ? (
        <ShopNotice tone="error" title="Could not update basket">
          {error}
        </ShopNotice>
      ) : null}
    </div>
  );
}
