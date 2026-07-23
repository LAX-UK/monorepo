"use client";

import { Button } from "@auction/ui/components/button";
import type { ReactNode, RefObject } from "react";

type Props = {
  panelRef?: RefObject<HTMLDivElement | null>;
  title: string;
  description: string;
  onCancel: () => void;
  children: ReactNode;
};

/** Compact add-panel chrome with focus target and explicit cancel. */
export function CatalogMediaAddPanel({ panelRef, title, description, onCancel, children }: Props) {
  return (
    <div ref={panelRef}>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="font-headline text-base font-semibold text-on-surface">{title}</h3>
          <p className="mt-1 font-body text-sm text-on-surface-variant">{description}</p>
        </div>
        <Button type="button" variant="ghost" size="sm" onClick={onCancel}>
          Cancel
        </Button>
      </div>
      {children}
    </div>
  );
}
