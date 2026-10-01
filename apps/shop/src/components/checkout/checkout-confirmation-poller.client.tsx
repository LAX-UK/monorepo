"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";

type Props = {
  active: boolean;
};

/** Refreshes server-rendered confirmation while payment is still processing. */
export function CheckoutConfirmationPoller({ active }: Props) {
  const router = useRouter();

  useEffect(() => {
    if (!active) {
      return;
    }
    const interval = setInterval(() => {
      router.refresh();
    }, 3_000);
    const stop = setTimeout(() => {
      clearInterval(interval);
    }, 30_000);
    return () => {
      clearInterval(interval);
      clearTimeout(stop);
    };
  }, [active, router]);

  return null;
}
