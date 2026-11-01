import { LaxDensityProvider, laxDensityAttributes } from "@auction/ui/lax";
import type { ReactNode } from "react";

/**
 * A lot page that cannot show a lot (not found, could not load): the kit's empty state inside the
 * site shell, with a way forward. The page chrome stays, so the visitor is never stranded.
 */
export function LotPageMessage({ children }: { children: ReactNode }) {
  return (
    <LaxDensityProvider density="client">
      <main
        id="main-content"
        {...laxDensityAttributes("client")}
        className="mx-auto w-full max-w-[1100px] px-4 pt-[calc(var(--header-height)+2.5rem)] pb-[var(--page-bottom-padding)] font-lax text-lax-fg md:px-10"
      >
        {children}
      </main>
    </LaxDensityProvider>
  );
}
