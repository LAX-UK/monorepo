"use client";

import { setClientWorkspaceModeAction } from "@/lib/actions/workspace";
import type { ClientWorkspaceMode } from "@/lib/workspace/client-workspace-mode";
import { cn } from "@auction/ui";
import {
  BottomSheet,
  BottomSheetContent,
  BottomSheetHeader,
  BottomSheetTitle,
  BottomSheetTrigger,
} from "@auction/ui/components/bottom-sheet";
import { Button } from "@auction/ui/components/button";
import { ChevronDown } from "lucide-react";
import { useState, useTransition } from "react";

type Props = {
  mode: ClientWorkspaceMode;
  hidden?: boolean;
  /** Inline buttons for embedding in another sheet (no nested overlay). */
  variant?: "sheet" | "inline";
};

export function WorkspaceModeSwitcher({ mode, hidden, variant = "sheet" }: Props) {
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

  const workspaceButtons = (
    <>
      <Button
        type="button"
        variant={mode === "buying" ? "cta" : "secondary"}
        className="min-h-12 w-full justify-start font-body text-sm"
        disabled={pending}
        onClick={() => switchTo("buying")}
      >
        Buying — bids, collection, watchlist
      </Button>
      <Button
        type="button"
        variant={mode === "selling" ? "cta" : "secondary"}
        className="min-h-12 w-full justify-start font-body text-sm"
        disabled={pending}
        onClick={() => switchTo("selling")}
      >
        Selling — submissions, consignments, payouts
      </Button>
    </>
  );

  if (variant === "inline") {
    return (
      <div className="grid gap-3">
        <p className="font-label text-xs uppercase tracking-[var(--text-label-caps-tracking,0.22em)] text-secondary">
          Workspace
        </p>
        {workspaceButtons}
      </div>
    );
  }

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
        <BottomSheet open={open} onOpenChange={setOpen}>
          <BottomSheetTrigger asChild>
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
          </BottomSheetTrigger>
          <BottomSheetContent className="border-outline-variant">
            <BottomSheetHeader>
              <BottomSheetTitle className="font-label text-xs uppercase tracking-[var(--text-label-caps-tracking,0.22em)] text-secondary">
                Workspace
              </BottomSheetTitle>
            </BottomSheetHeader>
            <div className="grid gap-3 px-6 pb-6">{workspaceButtons}</div>
          </BottomSheetContent>
        </BottomSheet>
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
    <Button
      type="button"
      variant="ghost"
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        "h-auto min-h-9 flex-1 rounded-full px-3 font-label text-[10px] font-bold uppercase tracking-[0.12em] transition-colors hover:text-inherit focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary focus-visible:ring-0 focus-visible:ring-offset-0",
        active
          ? "bg-primary text-on-primary shadow-sm hover:bg-primary hover:text-on-primary"
          : "text-on-surface-variant hover:bg-surface-container-lowest/80 hover:text-on-surface",
      )}
    >
      {children}
    </Button>
  );
}
