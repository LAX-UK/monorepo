"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";

export function ShopBasketCancelNotice() {
  const searchParams = useSearchParams();
  const pathname = usePathname();
  const router = useRouter();

  if (searchParams.get("cancelled") !== "1") {
    return null;
  }

  function dismiss() {
    const params = new URLSearchParams(searchParams.toString());
    params.delete("cancelled");
    const query = params.toString();
    router.replace(query ? `${pathname}?${query}` : pathname);
  }

  return (
    <output className="shop-basket__alert" role="alert">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <p>Payment was cancelled. Your basket is unchanged — adjust items or try checkout again.</p>
        <button type="button" className="shop-focus-ring text-sm underline" onClick={dismiss}>
          Dismiss
        </button>
      </div>
    </output>
  );
}
