"use client";

import { Popover, PopoverContent, PopoverTrigger } from "@auction/ui/components/popover";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetTitle,
  SheetTrigger,
} from "@auction/ui/components/sheet";
import { useMinWidthMd } from "@auction/ui/hooks/use-media-query";
import { StatusBadge, type StatusPresentation } from "@auction/ui/lax";
import * as React from "react";
import { STAFF_LAYER, cn } from "../lib/cn.js";

export type StatusDetailsButtonProps = {
  /** The badge: its label is also the details' heading. */
  status: StatusPresentation;
  /**
   * The button's accessible name, which must include the state: "Zoho: Mirrored to Zoho, details".
   */
  name: string;
  /** What the details say under the heading: a sentence, a copy button, a link. */
  children: React.ReactNode;
  className?: string;
} & Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, "children" | "type" | "aria-label">;

const TITLE_CLASS = "font-staff text-staff-sm font-semibold text-staff-fg";
const BODY_CLASS = "flex flex-col gap-2 text-staff-sm text-staff-muted";

/**
 * A status badge that opens a few lines of detail about that status. It is a button, never a
 * hover-only tooltip, so a phone and a keyboard reach it too: from `md` up the details are a
 * popover beside the badge, below `md` a bottom sheet with a 44px close. Either is a dialog that
 * takes focus in and gives it back to the badge on Esc or close. The badge keeps its 20px size; its
 * hit area grows to 44px tall around it.
 */
export function StatusDetailsButton({
  status,
  name,
  children,
  className,
  ...buttonProps
}: StatusDetailsButtonProps) {
  const [open, setOpen] = React.useState(false);
  // Null until measured, which keeps the popover: it is right on every width until the first tap.
  const isPhone = useMinWidthMd() === false;
  const titleId = React.useId();
  const bodyId = React.useId();

  // Crossing the breakpoint while open would leave the wrong overlay up, so it closes instead.
  const wasPhone = React.useRef(isPhone);
  React.useEffect(() => {
    if (wasPhone.current !== isPhone) setOpen(false);
    wasPhone.current = isPhone;
  }, [isPhone]);

  const trigger = (
    <button
      type="button"
      {...buttonProps}
      aria-label={name}
      className={cn(
        "staff-focus relative inline-flex shrink-0 cursor-pointer rounded-staff-xs after:absolute after:-inset-x-1 after:-inset-y-3 after:content-[''] hover:brightness-95 dark:hover:brightness-110",
        className,
      )}
    >
      <StatusBadge
        tone={status.tone}
        live={status.live ?? false}
        {...(status.shape ? { shape: status.shape } : {})}
      >
        {status.label}
      </StatusBadge>
    </button>
  );

  if (isPhone) {
    return (
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetTrigger asChild>{trigger}</SheetTrigger>
        <SheetContent
          {...STAFF_LAYER}
          side="bottom"
          overlayClassName="bg-staff-scrim"
          className="border-t border-staff-line bg-staff-surface text-staff-fg shadow-staff-lg"
        >
          <div className="flex flex-col gap-2 px-4 pb-[max(env(safe-area-inset-bottom,0px),1rem)]">
            <SheetTitle className={TITLE_CLASS}>{status.label}</SheetTitle>
            <SheetDescription asChild>
              <div className={BODY_CLASS}>{children}</div>
            </SheetDescription>
          </div>
        </SheetContent>
      </Sheet>
    );
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>{trigger}</PopoverTrigger>
      <PopoverContent
        {...STAFF_LAYER}
        align="start"
        sideOffset={6}
        aria-labelledby={titleId}
        aria-describedby={bodyId}
        className="flex w-80 max-w-[calc(100vw-2rem)] flex-col gap-2 rounded-staff-md border border-staff-line bg-staff-raised p-3 text-staff-fg shadow-staff-md"
      >
        <h2 id={titleId} className={TITLE_CLASS}>
          {status.label}
        </h2>
        <div id={bodyId} className={BODY_CLASS}>
          {children}
        </div>
      </PopoverContent>
    </Popover>
  );
}
