"use client";

import { addMerchandiseVariantToBasket } from "@/app/actions/basket.actions";
import { ShopCommerceButton } from "@/components/shop-commerce-button";
import { ShopNotice } from "@/components/shop-notice";
import { commerceErrorMessage } from "@/lib/commerce-error-message";
import { formatGbpPence } from "@/lib/presenters/shop-money.presenter";
import type { PublicMerchandiseProductDetail } from "@auction/shop-contracts";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

type Props = {
  product: PublicMerchandiseProductDetail;
};

function firstInStockVariantId(product: PublicMerchandiseProductDetail): string {
  const inStock = product.variants.find((variant) => variant.availableCount > 0);
  return inStock?.variantId ?? product.variants[0]?.variantId ?? "";
}

export function MerchandiseVariantPicker({ product }: Props) {
  const router = useRouter();
  const [selectedVariantId, setSelectedVariantId] = useState(() =>
    firstInStockVariantId(product),
  );
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const selected = product.variants.find((variant) => variant.variantId === selectedVariantId);
  const canAdd = Boolean(selected && selected.availableCount > 0);

  function addToBasket() {
    if (!selectedVariantId || !canAdd) return;
    setError(null);
    startTransition(async () => {
      const result = await addMerchandiseVariantToBasket(selectedVariantId, 1);
      if (!result.ok) {
        setError(
          commerceErrorMessage(result.error, "Could not add to basket. The variant may have sold out."),
        );
        return;
      }
      router.push("/basket");
    });
  }

  return (
    <div className="flex flex-col gap-4">
      <fieldset>
        <legend className="font-semibold">Choose a variant</legend>
        <ul className="flex flex-col gap-2">
          {product.variants.map((variant) => {
            const soldOut = variant.availableCount <= 0;
            return (
              <li key={variant.variantId}>
                <label className="flex items-center gap-2">
                  <input
                    type="radio"
                    name="variant"
                    value={variant.variantId}
                    checked={selectedVariantId === variant.variantId}
                    disabled={soldOut}
                    onChange={() => setSelectedVariantId(variant.variantId)}
                  />
                  <span className={soldOut ? "text-on-surface-variant" : undefined}>
                    {variant.sku} · {formatGbpPence(variant.pricePence)} ·{" "}
                    {soldOut ? "Sold out" : `${variant.availableCount} available`}
                  </span>
                </label>
              </li>
            );
          })}
        </ul>
      </fieldset>
      <ShopCommerceButton
        type="button"
        disabled={pending || !canAdd}
        onClick={addToBasket}
      >
        Add to basket
      </ShopCommerceButton>
      {error ? (
        <ShopNotice tone="error" title="Could not add to basket">
          {error}
        </ShopNotice>
      ) : null}
    </div>
  );
}
