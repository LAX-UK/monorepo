"use client";

import { cn } from "@auction/ui";
import { Alert, AlertDescription, AlertTitle } from "@auction/ui/components/alert";
import { Button } from "@auction/ui/components/button";
import { AlertTriangle, X } from "lucide-react";
import type { ReactNode } from "react";

export type DetailNoticeBannerProps = {
  title: ReactNode;
  message: ReactNode;
  onDismiss?: () => void;
  className?: string;
};

/** Figma-style warning notice for draft mode, connect, and setup banners. */
export function DetailNoticeBanner({
  title,
  message,
  onDismiss,
  className,
}: DetailNoticeBannerProps) {
  return (
    <Alert className={cn("border-warning/40 bg-warning-container/20", className)} role="alert">
      <AlertTriangle className="size-4 text-warning" aria-hidden />
      <div className="flex flex-1 items-start justify-between gap-3">
        <div className="min-w-0 space-y-1">
          <AlertTitle className="font-headline text-sm font-semibold text-on-surface">
            {title}
          </AlertTitle>
          <AlertDescription className="font-body text-sm text-on-surface-variant">
            {message}
          </AlertDescription>
        </div>
        {onDismiss ? (
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="size-8 shrink-0"
            onClick={onDismiss}
            aria-label="Dismiss"
          >
            <X className="size-4" aria-hidden />
          </Button>
        ) : null}
      </div>
    </Alert>
  );
}
