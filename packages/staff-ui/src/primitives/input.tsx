"use client";

import * as React from "react";
import { staffReadOnlyBox, useStaffReadOnly } from "../access/read-only.js";
import { useStaffField } from "../forms/field.js";
import { cn } from "../lib/cn.js";

/**
 * The field box shared by text inputs, the money input, pickers and selects: one border, one
 * radius, one hover, one focus ring and one error treatment, so every control in a form lines up.
 */
export const staffFieldBox = [
  "flex w-full min-w-0 items-center gap-2 rounded-staff-sm border bg-staff-surface px-3",
  "font-staff text-staff-fg transition-[border-color,box-shadow] duration-150 ease-out",
  "border-staff-control-border hover:border-staff-control-border-hover",
  "has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-staff-focus",
  "has-[[aria-invalid=true]]:border-staff-danger",
  "has-[:disabled]:cursor-not-allowed has-[:disabled]:border-staff-line has-[:disabled]:bg-staff-sunken has-[:disabled]:text-staff-disabled",
  "has-[input:read-only,textarea:read-only]:bg-staff-sunken",
  "[&_svg]:size-4 [&_svg]:shrink-0 [&_svg]:text-staff-subtle",
].join(" ");

const fieldSize = {
  sm: "h-control-sm text-staff-sm",
  md: "h-control-md text-staff-md",
  /** 44px at every pointer, for fields a clerk fills under time pressure. */
  live: "h-11 text-staff-md",
} as const;

const bareInput =
  "h-full min-w-0 flex-1 bg-transparent outline-none placeholder:text-staff-subtle disabled:cursor-not-allowed [&::-webkit-search-cancel-button]:hidden";

export type TextInputProps = Omit<React.InputHTMLAttributes<HTMLInputElement>, "size"> & {
  size?: keyof typeof fieldSize;
  /** Icon or text before the value, e.g. a search icon or "£". */
  leading?: React.ReactNode;
  /** Icon, unit or action after the value, e.g. a kbd hint. */
  trailing?: React.ReactNode;
  invalid?: boolean;
  /** Classes for the outer box (width, margins); `className` styles the input itself. */
  boxClassName?: string;
};

export const TextInput = React.forwardRef<HTMLInputElement, TextInputProps>(
  (
    { size = "md", leading, trailing, invalid, boxClassName, className, id, disabled, ...props },
    ref,
  ) => {
    const field = useStaffField();
    const isInvalid = invalid ?? field?.invalid ?? false;
    const describedBy = props["aria-describedby"] ?? field?.describedBy;
    const inReadOnlyView = useStaffReadOnly();
    const readOnly = props.readOnly ?? (field?.readOnly || inReadOnlyView);
    return (
      <div
        {...(readOnly ? { "data-readonly": "" } : {})}
        className={cn(
          staffFieldBox,
          staffReadOnlyBox,
          fieldSize[size],
          "staff-target",
          boxClassName,
        )}
      >
        {leading}
        <input
          ref={ref}
          id={id ?? field?.controlId}
          disabled={disabled ?? field?.disabled}
          aria-invalid={isInvalid || undefined}
          {...(describedBy ? { "aria-describedby": describedBy } : {})}
          {...(field?.required && props.required === undefined ? { "aria-required": true } : {})}
          className={cn(bareInput, readOnly && "placeholder:opacity-0", className)}
          {...props}
          readOnly={readOnly}
        />
        {trailing}
      </div>
    );
  },
);
TextInput.displayName = "TextInput";

export type TextAreaProps = React.TextareaHTMLAttributes<HTMLTextAreaElement> & {
  invalid?: boolean;
};

export const TextArea = React.forwardRef<HTMLTextAreaElement, TextAreaProps>(
  ({ invalid, className, id, disabled, rows = 3, ...props }, ref) => {
    const field = useStaffField();
    const isInvalid = invalid ?? field?.invalid ?? false;
    const describedBy = props["aria-describedby"] ?? field?.describedBy;
    const inReadOnlyView = useStaffReadOnly();
    const readOnly = props.readOnly ?? (field?.readOnly || inReadOnlyView);
    return (
      <div
        {...(readOnly ? { "data-readonly": "" } : {})}
        className={cn(staffFieldBox, staffReadOnlyBox, "items-stretch px-0 py-0 text-staff-md")}
      >
        <textarea
          ref={ref}
          rows={rows}
          id={id ?? field?.controlId}
          disabled={disabled ?? field?.disabled}
          aria-invalid={isInvalid || undefined}
          {...(describedBy ? { "aria-describedby": describedBy } : {})}
          className={cn(
            "min-h-[76px] w-full resize-y bg-transparent px-3 py-2 outline-none placeholder:text-staff-subtle disabled:cursor-not-allowed",
            readOnly && "resize-none placeholder:opacity-0",
            className,
          )}
          {...props}
          readOnly={readOnly}
        />
      </div>
    );
  },
);
TextArea.displayName = "TextArea";

/** A keyboard hint, e.g. ⌘K. */
export function Kbd({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <kbd
      className={cn(
        "inline-flex h-5 min-w-5 items-center justify-center rounded-staff-xs border border-staff-line bg-staff-sunken px-1 font-staff text-staff-2xs font-medium text-staff-muted",
        className,
      )}
    >
      {children}
    </kbd>
  );
}

const KEY_GLYPHS: Record<string, string> = {
  shift: "⇧",
  alt: "⌥",
  enter: "↵",
  escape: "esc",
  arrowup: "↑",
  arrowdown: "↓",
};

/**
 * "g o" as two key caps, "mod+s" as ⌘ S (Ctrl S off a Mac), "?" as itself. The server renders ⌘
 * and the browser corrects it after mount, so the first paint matches.
 */
export function ShortcutKeys({ keys, className }: { keys: string; className?: string }) {
  const [mac, setMac] = React.useState(true);
  React.useEffect(() => {
    setMac(/Mac|iPhone|iPad/.test(navigator.platform || navigator.userAgent));
  }, []);
  const steps = keys.split(" ");
  return (
    <span className={cn("inline-flex items-center gap-1", className)}>
      {steps.map((step, index) => (
        <React.Fragment key={`${step}-${index.toString()}`}>
          {index > 0 ? <span className="text-staff-xs text-staff-subtle">then</span> : null}
          {step.split("+").map((part) => (
            <Kbd key={part}>
              {part === "mod"
                ? mac
                  ? "⌘"
                  : "Ctrl"
                : (KEY_GLYPHS[part] ?? (part.length === 1 ? part.toUpperCase() : part))}
            </Kbd>
          ))}
        </React.Fragment>
      ))}
    </span>
  );
}
