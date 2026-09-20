"use client";

import { addArtworkToBasket } from "@/app/actions/basket.actions";
import { commerceErrorMessage } from "@/lib/commerce-error-message";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

type Props = {
  slug: string;
  disabled?: boolean;
};

export function AddToBasketButton({ slug, disabled }: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  return (
    <div className="shop-detail__purchase">
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
            router.push("/basket");
            router.refresh();
          });
        }}
      >
        {pending ? "Adding…" : "Add to basket"}
      </button>
      {error ? (
        <p className="shop-detail__notice shop-detail__notice--alert" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}
