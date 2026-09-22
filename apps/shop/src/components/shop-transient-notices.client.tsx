"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";

const MERGE_PARAM = "basketMerge";

export function ShopTransientNotices() {
  const searchParams = useSearchParams();
  const pathname = usePathname();
  const router = useRouter();
  const basketMerge = searchParams.get(MERGE_PARAM);

  if (!basketMerge) {
    return null;
  }

  const message =
    basketMerge === "merged"
      ? "Your guest basket was merged into your signed-in account."
      : basketMerge === "failed"
        ? "We could not merge your guest basket after sign-in. Your items may still be on this device."
        : null;

  if (!message) {
    return null;
  }

  function dismiss() {
    const params = new URLSearchParams(searchParams.toString());
    params.delete(MERGE_PARAM);
    const query = params.toString();
    router.replace(query ? `${pathname}?${query}` : pathname);
  }

  return (
    <div
      className="shop-basket__alert mx-auto max-w-[var(--container-max,90rem)] px-4 py-3"
      role={basketMerge === "failed" ? "alert" : "status"}
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <p className="text-sm">{message}</p>
        <button type="button" className="shop-focus-ring text-sm underline" onClick={dismiss}>
          Dismiss
        </button>
      </div>
    </div>
  );
}
