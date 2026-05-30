"use client";

import { HideBottomTabBarWhileMounted } from "@/lib/shell/shell-chrome-context";
import { Button } from "@auction/ui/components/button";

type Props = {
  totalLabel: string;
  formId: string;
};

/** Hides bottom tabs and renders a mobile checkout pay bar above safe area. */
export function CheckoutLotMobileChrome({ totalLabel, formId }: Props) {
  return (
    <>
      <HideBottomTabBarWhileMounted />
      <div className="fixed inset-x-0 bottom-0 z-30 flex items-center justify-between gap-3 border-t border-border-hairline bg-surface-container-lowest/95 px-4 py-3 shadow-sm pb-[max(0.75rem,calc(env(safe-area-inset-bottom)+var(--bottom-tab-bar-bottom,0px)))] backdrop-blur-md supports-[backdrop-filter]:bg-surface-container-lowest/90 lg:hidden">
        <div>
          <p className="font-label text-[10px] uppercase tracking-[var(--text-label-caps-tracking,0.22em)] text-secondary">
            Total due
          </p>
          <p className="font-headline text-lg tabular-nums text-primary">{totalLabel}</p>
        </div>
        <Button
          type="submit"
          form={formId}
          variant="cta"
          className="min-h-11 min-w-[10rem] font-label text-xs uppercase tracking-[var(--text-label-caps-tracking,0.22em)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
        >
          Complete purchase
        </Button>
      </div>
    </>
  );
}
