"use client";

import { ShopNotice } from "@/components/shop-notice";
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
    <ShopNotice
      tone={basketMerge === "failed" ? "error" : "success"}
      className="shop-transient-notice mx-auto max-w-[var(--container-max,90rem)] rounded-none border-x-0 border-t-0"
      onDismiss={dismiss}
    >
      <p className="m-0 text-sm">{message}</p>
    </ShopNotice>
  );
}
