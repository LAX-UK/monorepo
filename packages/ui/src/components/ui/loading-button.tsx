"use client";

import { Loader2 } from "lucide-react";
import * as React from "react";
import { cn } from "../../lib/utils.js";
import { Button, type ButtonProps } from "./button.js";

export type LoadingButtonProps = ButtonProps & {
  loading?: boolean;
  loadingLabel?: string;
};

export const LoadingButton = React.forwardRef<HTMLButtonElement, LoadingButtonProps>(
  ({ loading, loadingLabel, disabled, children, className, ...props }, ref) => {
    return (
      <Button
        ref={ref}
        disabled={disabled || loading}
        aria-busy={loading || undefined}
        className={cn(className)}
        {...props}
      >
        {loading ? (
          <>
            <Loader2 className="size-4 animate-spin" aria-hidden />
            <span>{loadingLabel ?? children}</span>
          </>
        ) : (
          children
        )}
      </Button>
    );
  },
);
LoadingButton.displayName = "LoadingButton";
