"use client";

import { useOverlayTone } from "@/components/ui/overlay-tone-context";
import {
  overlayDisplayClasses,
  overlayTextClasses,
  overlayTextMutedClasses,
  overlayToneProps,
} from "@/lib/ui/overlay-tone-classes";
import { cn } from "@auction/ui";
import type { ComponentPropsWithoutRef, ElementType } from "react";

type Variant = "body" | "muted" | "display";

type Props<T extends ElementType> = {
  as?: T;
  variant?: Variant;
  slot?: "contentBlock";
  className?: string;
} & Omit<ComponentPropsWithoutRef<T>, "as" | "className">;

/** Text wrapper that reads grouped hero/card copy tone from the nearest AdaptiveMediaFrame. */
export function OverlayToneText<T extends ElementType = "span">({
  as,
  variant = "body",
  slot = "contentBlock",
  className,
  ...rest
}: Props<T>) {
  const Component = as ?? "span";
  const result = useOverlayTone(slot);

  const classes =
    variant === "display"
      ? overlayDisplayClasses(result, className)
      : variant === "muted"
        ? overlayTextMutedClasses(result, className)
        : overlayTextClasses(result, className);

  return <Component className={cn(classes)} {...overlayToneProps(result)} {...rest} />;
}
