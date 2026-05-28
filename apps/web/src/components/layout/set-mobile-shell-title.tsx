"use client";

import { useShellChrome } from "@/lib/shell/shell-chrome-context";
import { useEffect } from "react";

/** Overrides the mobile shell title while mounted (e.g. lot checkout with artwork title). */
export function SetMobileShellTitle({ title }: { title: string }) {
  const { setMobileTitleOverride } = useShellChrome();
  useEffect(() => {
    setMobileTitleOverride(title);
    return () => setMobileTitleOverride(null);
  }, [title, setMobileTitleOverride]);
  return null;
}
