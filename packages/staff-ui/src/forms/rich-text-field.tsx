"use client";

import { fieldBox, readOnlyBox, useField } from "@auction/ui/lax";
import { Bold, Italic, Link2, Unlink } from "lucide-react";
import * as React from "react";
import { cn } from "../lib/cn.js";
import { StaffButton } from "../primitives/button.js";
import { StaffTooltip, StaffTooltipProvider } from "../primitives/menu.js";
import { type RichTextSpan, htmlToSpans, normalizeSpans, spansToHtml } from "./rich-text-model.js";

export type RichTextFieldProps = {
  value: readonly RichTextSpan[];
  onChange: (spans: RichTextSpan[]) => void;
  /** Whether a link address may be saved; the field refuses and explains when it may not. */
  isSafeHref: (href: string) => boolean;
  /** Said under the link box when the address is refused: "Use https://…, mailto:… or /path". */
  hrefHint: string;
  /** Names the writing area when no `Field` label points at it. */
  "aria-label"?: string;
  invalid?: boolean;
  disabled?: boolean;
  id?: string;
  /** Visible lines before the area scrolls; default 4. */
  rows?: number;
};

type Selection = { range: Range } | null;

function stateOf(command: "bold" | "italic"): boolean {
  try {
    return document.queryCommandState?.(command) ?? false;
  } catch {
    return false;
  }
}

function anchorAt(root: HTMLElement | null): HTMLAnchorElement | null {
  const selection = window.getSelection();
  if (!root || !selection || selection.rangeCount === 0) return null;
  let node: Node | null = selection.anchorNode;
  while (node && node !== root) {
    if (node.nodeType === 1 && (node as Element).tagName === "A") return node as HTMLAnchorElement;
    node = node.parentNode;
  }
  return null;
}

function selectionInside(root: HTMLElement | null): Range | null {
  const selection = window.getSelection();
  if (!root || !selection || selection.rangeCount === 0) return null;
  const range = selection.getRangeAt(0);
  return root.contains(range.commonAncestorContainer) ? range : null;
}

/**
 * A paragraph editor for bold, italic and links: the text as it will read, a toolbar above it and
 * the usual shortcuts (Ctrl or Cmd with B and I). It reads and writes the editorial run format
 * directly, so what is saved is exactly what lax.art renders. Enter adds a line break (a new
 * paragraph is a new block), pasted text is plain, and a link is only kept with an address that
 * passes `isSafeHref`.
 */
export function RichTextField({
  value,
  onChange,
  isSafeHref,
  hrefHint,
  "aria-label": ariaLabel,
  invalid,
  disabled,
  id,
  rows = 4,
}: RichTextFieldProps) {
  const field = useField();
  const controlId = id ?? field?.controlId;
  const isInvalid = invalid ?? field?.invalid ?? false;
  const isDisabled = disabled ?? field?.disabled ?? false;
  const readOnly = field?.readOnly ?? false;
  const describedBy = field?.describedBy;
  const linkInputId = React.useId();
  const linkHintId = React.useId();

  const surface = React.useRef<HTMLDivElement | null>(null);
  const emitted = React.useRef<string>("");
  const [active, setActive] = React.useState({ bold: false, italic: false, link: false });
  const [canLink, setCanLink] = React.useState(false);
  const [linkOpen, setLinkOpen] = React.useState(false);
  const [href, setHref] = React.useState("");
  const [hrefError, setHrefError] = React.useState(false);
  const saved = React.useRef<Selection>(null);
  const linkInput = React.useRef<HTMLInputElement | null>(null);

  // Show the value when it first arrives or changes from outside; never rewrite the surface for
  // a change this field just made, which would move the caret.
  React.useLayoutEffect(() => {
    const element = surface.current;
    if (!element) return;
    const html = spansToHtml(value);
    const key = JSON.stringify(normalizeSpans(value));
    if (key === emitted.current) return;
    emitted.current = key;
    element.innerHTML = html;
  }, [value]);

  const refreshToolbar = React.useCallback(() => {
    const element = surface.current;
    const range = selectionInside(element);
    if (!range) {
      setCanLink(false);
      return;
    }
    const link = anchorAt(element);
    setActive({ bold: stateOf("bold"), italic: stateOf("italic"), link: Boolean(link) });
    setCanLink(Boolean(link) || !range.collapsed);
  }, []);

  React.useEffect(() => {
    document.addEventListener("selectionchange", refreshToolbar);
    return () => document.removeEventListener("selectionchange", refreshToolbar);
  }, [refreshToolbar]);

  const commit = React.useCallback(() => {
    const element = surface.current;
    if (!element) return;
    const spans = htmlToSpans(element);
    emitted.current = JSON.stringify(spans);
    onChange(spans);
    refreshToolbar();
  }, [onChange, refreshToolbar]);

  const run = (command: "bold" | "italic") => {
    if (isDisabled) return;
    surface.current?.focus();
    document.execCommand(command);
    commit();
  };

  const openLink = () => {
    const element = surface.current;
    const range = selectionInside(element);
    if (!range) return;
    saved.current = { range: range.cloneRange() };
    const existing = anchorAt(element);
    setHref(existing?.getAttribute("href") ?? "");
    setHrefError(false);
    setLinkOpen(true);
    queueMicrotask(() => linkInput.current?.focus());
  };

  const closeLink = () => {
    setLinkOpen(false);
    setHrefError(false);
    surface.current?.focus();
    const selection = window.getSelection();
    if (saved.current && selection) {
      selection.removeAllRanges();
      selection.addRange(saved.current.range);
    }
  };

  const applyLink = () => {
    const address = href.trim();
    if (!isSafeHref(address)) {
      setHrefError(true);
      linkInput.current?.focus();
      return;
    }
    closeLink();
    document.execCommand("createLink", false, address);
    commit();
  };

  const removeLink = () => {
    closeLink();
    document.execCommand("unlink");
    commit();
  };

  const toolbarButton = (
    label: string,
    pressed: boolean,
    icon: React.ReactNode,
    onClick: () => void,
    unavailable = false,
  ) => (
    <StaffTooltip label={label}>
      <StaffButton
        type="button"
        variant="ghost"
        size="icon-sm"
        aria-label={label}
        aria-pressed={pressed}
        aria-disabled={unavailable || isDisabled || undefined}
        disabled={isDisabled}
        // Keep the selection in the writing area when a toolbar button is pressed.
        onMouseDown={(event) => event.preventDefault()}
        onClick={() => {
          if (unavailable) return;
          onClick();
        }}
        className={cn(
          "[&_svg]:text-staff-fg! aria-disabled:[&_svg]:text-staff-disabled!",
          pressed && "bg-staff-pressed",
        )}
      >
        {icon}
      </StaffButton>
    </StaffTooltip>
  );

  return (
    <div
      {...(readOnly ? { "data-readonly": "" } : {})}
      className={cn(fieldBox, readOnlyBox, "h-auto flex-col items-stretch gap-0 p-0")}
    >
      {readOnly ? null : (
        <StaffTooltipProvider>
          <div
            role="toolbar"
            aria-label="Text formatting"
            className="flex items-center gap-0.5 border-b border-staff-line-subtle px-1.5 py-1"
          >
            {toolbarButton("Bold", active.bold, <Bold aria-hidden />, () => run("bold"))}
            {toolbarButton("Italic", active.italic, <Italic aria-hidden />, () => run("italic"))}
            {toolbarButton(
              active.link ? "Edit link" : "Add link",
              active.link || linkOpen,
              <Link2 aria-hidden />,
              openLink,
              !canLink,
            )}
            {active.link
              ? toolbarButton("Remove link", false, <Unlink aria-hidden />, removeLink)
              : null}
          </div>
        </StaffTooltipProvider>
      )}
      {linkOpen && !readOnly ? (
        <div className="flex flex-col gap-1.5 border-b border-staff-line-subtle bg-staff-sunken px-3 py-2.5">
          <label htmlFor={linkInputId} className="text-staff-xs font-medium text-staff-fg">
            Link address
          </label>
          <div className="flex flex-wrap items-center gap-2">
            <input
              ref={linkInput}
              id={linkInputId}
              type="text"
              inputMode="url"
              autoComplete="off"
              spellCheck={false}
              value={href}
              aria-invalid={hrefError || undefined}
              aria-describedby={linkHintId}
              placeholder="https://…"
              onChange={(event) => {
                setHref(event.target.value);
                setHrefError(false);
              }}
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  event.preventDefault();
                  applyLink();
                }
                if (event.key === "Escape") {
                  event.preventDefault();
                  event.stopPropagation();
                  closeLink();
                }
              }}
              className={cn(
                "h-control-sm min-w-0 flex-1 basis-48 rounded-staff-sm border bg-staff-surface px-2.5 text-staff-sm text-staff-fg outline-none placeholder:text-staff-subtle",
                "border-staff-control-border hover:border-staff-control-border-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-staff-focus",
                hrefError && "border-staff-danger",
              )}
            />
            <StaffButton type="button" size="sm" variant="primary" onClick={applyLink}>
              Apply
            </StaffButton>
            <StaffButton type="button" size="sm" variant="ghost" onClick={closeLink}>
              Cancel
            </StaffButton>
          </div>
          <p
            id={linkHintId}
            className={cn("text-staff-xs", hrefError ? "text-staff-danger" : "text-staff-muted")}
          >
            {hrefHint}
          </p>
        </div>
      ) : null}
      <div
        ref={surface}
        id={controlId}
        role="textbox"
        aria-multiline="true"
        aria-label={ariaLabel}
        aria-labelledby={ariaLabel ? undefined : field?.labelId}
        aria-invalid={isInvalid || undefined}
        aria-disabled={isDisabled || undefined}
        aria-readonly={readOnly || undefined}
        {...(describedBy ? { "aria-describedby": describedBy } : {})}
        contentEditable={!isDisabled && !readOnly}
        suppressContentEditableWarning
        tabIndex={isDisabled ? -1 : 0}
        spellCheck
        style={{ minHeight: `${rows * 1.5 + 1}rem` }}
        className={cn(
          "staff-rich-text w-full whitespace-pre-wrap break-words rounded-b-staff-sm px-3 py-2 text-staff-md leading-6 text-staff-fg outline-none",
          "[&_a]:underline [&_a]:decoration-staff-line-strong [&_a]:underline-offset-2 [&_em]:italic [&_strong]:font-semibold",
          isDisabled && "cursor-not-allowed text-staff-disabled",
        )}
        onInput={commit}
        onBlur={commit}
        onKeyDown={(event) => {
          if (event.key === "Enter") {
            event.preventDefault();
            document.execCommand("insertLineBreak");
            commit();
          }
        }}
        onPaste={(event) => {
          event.preventDefault();
          const text = event.clipboardData.getData("text/plain").replace(/\r\n?/g, "\n");
          document.execCommand("insertText", false, text);
          commit();
        }}
      />
    </div>
  );
}
