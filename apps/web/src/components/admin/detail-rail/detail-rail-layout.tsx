"use client";

import { Button } from "@auction/ui/components/button";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@auction/ui/components/sheet";
import { PanelRight } from "lucide-react";
import type { ReactNode } from "react";

type Props = {
  rail: ReactNode;
  children: ReactNode;
};

/** Two-column detail layout with sticky rail on lg+; collapses to a Context sheet on small screens. */
export function DetailRailLayout({ rail, children }: Props) {
  return (
    <>
      <div className="mb-4 lg:hidden">
        <Sheet>
          <SheetTrigger asChild>
            <Button type="button" variant="outline" size="sm" className="gap-2">
              <PanelRight className="size-4" aria-hidden />
              Context
            </Button>
          </SheetTrigger>
          <SheetContent side="right" className="w-full max-w-sm overflow-y-auto">
            <SheetHeader>
              <SheetTitle>Context</SheetTitle>
            </SheetHeader>
            <div className="mt-4 space-y-6">{rail}</div>
          </SheetContent>
        </Sheet>
      </div>
      <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(16rem,22rem)]">
        <div className="min-w-0">{children}</div>
        <aside className="hidden min-w-0 space-y-6 lg:sticky lg:top-24 lg:block lg:self-start">
          {rail}
        </aside>
      </div>
    </>
  );
}
