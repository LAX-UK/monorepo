"use client";

import { Loader2 } from "lucide-react";
import * as React from "react";
import { cn } from "../../lib/utils.js";
import { Button, type ButtonProps } from "./button.js";

export type LoadingButtonProps = ButtonProps & {
  loading?: boolean;
  /** Replaces the label while loading, only where the idle label would mislead ("Saving…"). */
  loadingLabel?: string;
};

const LAYER = "col-start-1 row-start-1 inline-flex items-center justify-center gap-[inherit]";

/**
 * A button for an action that takes a moment. While loading it keeps its colour and its width,
 * shows a spinner before the label, reports `aria-busy`, stays focusable and ignores presses, so
 * a second press cannot send the action twice. The idle and loading layers share one grid cell,
 * which is as wide as the wider of the two, so the button never jumps between states.
 */
export const LoadingButton = React.forwardRef<HTMLButtonElement, LoadingButtonProps>(
  ({ loading = false, loadingLabel, children, onClick, className, ...props }, ref) => {
    return (
      <Button
        ref={ref}
        aria-busy={loading || undefined}
        data-loading={loading || undefined}
        onClick={loading ? (event) => event.preventDefault() : onClick}
        className={className}
        {...props}
      >
        <span className="inline-grid gap-[inherit]">
          <span className={cn(LAYER, loading && "invisible")} aria-hidden={loading || undefined}>
            {children}
          </span>
          <span className={cn(LAYER, !loading && "invisible")} aria-hidden={!loading || undefined}>
            <Loader2 className={cn(loading && "animate-spin")} aria-hidden />
            <span>{loadingLabel ?? children}</span>
          </span>
        </span>
      </Button>
    );
  },
);
LoadingButton.displayName = "LoadingButton";

/** Alias for submit/async actions across auth and dashboard surfaces. */
export const AsyncButton = LoadingButton;
export type AsyncButtonProps = LoadingButtonProps;
