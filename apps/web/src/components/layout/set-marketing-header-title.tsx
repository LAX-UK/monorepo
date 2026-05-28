"use client";

import { useMarketingHeaderTitle } from "@/lib/marketing/marketing-header-title-context";
import { useEffect } from "react";

/** Sets the mobile marketing header title while mounted (e.g. lot PDP artwork title). */
export function SetMarketingHeaderTitle({ title }: { title: string }) {
  const { setTitle } = useMarketingHeaderTitle();
  useEffect(() => {
    setTitle(title);
    return () => setTitle(null);
  }, [title, setTitle]);
  return null;
}
