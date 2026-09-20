"use client";

import { ShopStatusStateAction } from "@/components/shop-status-state";
import { useRouter } from "next/navigation";

type ShopCatalogueStateRetryButtonProps = {
  label?: string;
};

export function ShopCatalogueStateRetryButton({
  label = "Try again",
}: ShopCatalogueStateRetryButtonProps) {
  const router = useRouter();

  return (
    <ShopStatusStateAction priority="primary" onClick={() => router.refresh()}>
      {label}
    </ShopStatusStateAction>
  );
}
