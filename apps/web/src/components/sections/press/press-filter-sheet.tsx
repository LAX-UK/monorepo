"use client";

import { MarketingFilterSheet } from "@/components/marketing/marketing-filter-sheet";
import { MarketingFilterTrigger } from "@/components/marketing/marketing-filter-trigger";
import { PressFilterForm } from "@/components/sections/press/press-filter-form";
import type { PressHubParams } from "@/lib/marketing/press-params";
import { useRouter } from "next/navigation";
import { useCallback, useId, useState } from "react";

type Props = {
  activeCount: number;
  initialParams: PressHubParams;
  years: number[];
  resultCount: number;
  resultCountLabel: string;
};

/** Mobile filter sheet for the press hub (`/press`). */
export function PressFilterSheet({
  activeCount,
  initialParams,
  years,
  resultCount,
  resultCountLabel,
}: Props) {
  const [open, setOpen] = useState(false);
  const router = useRouter();
  const formId = useId();
  const close = useCallback(() => setOpen(false), []);

  return (
    <MarketingFilterSheet
      open={open}
      onOpenChange={setOpen}
      title="Filters"
      description="Refine press coverage. Changes apply when you confirm."
      trigger={<MarketingFilterTrigger activeCount={activeCount} />}
      applyLabel={resultCountLabel}
      onApply={() => {
        const form = document.getElementById(formId) as HTMLFormElement | null;
        form?.requestSubmit();
      }}
      onReset={() => {
        router.push("/press");
        close();
      }}
    >
      <PressFilterForm
        formId={formId}
        initialParams={initialParams}
        years={years}
        resultCount={resultCount}
        variant="sheet"
        onSubmitted={close}
      />
    </MarketingFilterSheet>
  );
}
