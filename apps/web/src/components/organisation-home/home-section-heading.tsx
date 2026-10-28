import type { ReactNode } from "react";

/** The heading every Home section uses, so the sections read as one page. */
export function HomeSectionHeading({ id, children }: { id: string; children: ReactNode }) {
  return (
    <h2 id={id} className="font-headline text-lg font-semibold tracking-tight text-on-surface">
      {children}
    </h2>
  );
}
