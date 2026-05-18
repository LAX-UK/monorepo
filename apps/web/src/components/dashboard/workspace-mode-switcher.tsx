"use client";

import { setClientWorkspaceModeAction } from "@/lib/actions/workspace";
import type { ClientWorkspaceMode } from "@/lib/workspace/client-workspace-mode";
import { cn } from "@auction/ui";
import { Button } from "@auction/ui/components/button";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@auction/ui/components/sheet";
import { ChevronDown } from "lucide-react";
import { useState, useTransition } from "react";

type Props = {
  mode: ClientWorkspaceMode;
  hidden?: boolean;
};

export function WorkspaceModeSwitcher({ mode, hidden }: Props) {
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();

  const switchTo = (next: ClientWorkspaceMode) => {
    if (next === mode) {
      setOpen(false);
      return;
    }
    startTransition(() => {
      void setClientWorkspaceModeAction(
        next,
        next === "buying" ? "/dashboard" : "/dashboard/seller",
      );
    });
    setOpen(false);
  };

  if (hidden) return null;

  return (
    <>
      <div className="hidden rounded-full border border-outline-variant/25 bg-surface-container-high/40 p-0.5 lg:flex">
        <WorkspaceModeButton active={mode === "buying"} onClick={() => switchTo("buying")}>
          Buying
        </WorkspaceModeButton>
        <WorkspaceModeButton active={mode === "selling"} onClick={() => switchTo("selling")}>
          Selling
        </WorkspaceModeButton>
      </div>

      <div className="lg:hidden">
        <Sheet open={open} onOpenChange={setOpen}>
          <SheetTrigger asChild>
            <Button
              type="button"
              variant="outline"
              disabled={pending}
              className="h-auto min-h-11 w-full justify-between gap-2 border-outline-variant/30 py-2 font-label text-[11px] uppercase tracking-[0.14em]"
              aria-label={`Workspace: ${mode === "buying" ? "Buying" : "Selling and artist"}`}
            >
              <span>{mode === "buying" ? "Buying" : "Selling"}</span>
              <ChevronDown className="size-4 shrink-0 opacity-70" aria-hidden />
            </Button>
          </SheetTrigger>
          <SheetContent side="bottom" className="border-outline-variant">
            <SheetHeader>
              <SheetTitle className="font-label text-xs uppercase tracking-[var(--text-label-caps-tracking,0.22em)] text-secondary">
                Workspace
              </SheetTitle>
            </SheetHeader>
            <div className="mt-6 grid gap-3 pb-6">
              <Button
                type="button"
                variant={mode === "buying" ? "cta" : "secondary"}
                className="min-h-12 w-full justify-start font-body text-sm"
                onClick={() => switchTo("buying")}
              >
                Buying — bids, collection, watchlist
              </Button>
              <Button
                type="button"
                variant={mode === "selling" ? "cta" : "secondary"}
                className="min-h-12 w-full justify-start font-body text-sm"
                onClick={() => switchTo("selling")}
              >
                Selling — submissions, consignments, payouts
              </Button>
            </div>
          </SheetContent>
        </Sheet>
      </div>
    </>
  );
}

function WorkspaceModeButton({
  active,
  children,
  onClick,
}: {
  active: boolean;
  children: React.ReactNode;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        "min-h-9 flex-1 rounded-full px-3 font-label text-[10px] font-bold uppercase tracking-[0.12em] transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary",
        active
          ? "bg-primary text-on-primary shadow-sm"
          : "text-on-surface-variant hover:bg-surface-container-lowest/80 hover:text-on-surface",
      )}
    >
      {children}
    </button>
  );
}
