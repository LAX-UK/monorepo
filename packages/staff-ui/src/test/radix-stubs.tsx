/*
 * Stand-ins for the Radix layers (sheet, dialog, tooltip, menu) in jsdom, where their positioning
 * and focus loops make every query slow. They keep the open/close and select contracts, so the
 * kit's own behaviour is what a test exercises. Use them from a test file with
 * `vi.mock("@auction/ui/components/sheet", () => import("../test/radix-stubs.js").then((m) => m.sheet))`.
 */
import * as React from "react";

type Children = { children?: React.ReactNode };

export const sheet = {
  Sheet: ({ open, children }: { open: boolean } & Children) =>
    open ? <div data-testid="sheet">{children}</div> : null,
  SheetContent: ({ children }: Children) => <dialog open>{children}</dialog>,
  SheetTitle: ({ children }: Children) => <h2>{children}</h2>,
  SheetDescription: ({ children, className }: Children & { className?: string }) => (
    <p className={className}>{children}</p>
  ),
  SheetClose: ({ children }: Children) => children,
};

export const dialog = {
  Dialog: ({ open, children }: { open: boolean } & Children) =>
    open ? <dialog open>{children}</dialog> : null,
  DialogContent: ({ children }: Children) => <div>{children}</div>,
  DialogTitle: ({ children }: Children) => <h2>{children}</h2>,
  DialogDescription: ({ children }: Children) => <p>{children}</p>,
};

export const tooltip = {
  TooltipProvider: ({ children }: Children) => children,
  Tooltip: ({ children }: Children) => children,
  TooltipTrigger: ({ children }: Children) => children,
  TooltipContent: () => null,
};

type ItemProps = Children & {
  onSelect?: (event: Event) => void;
  disabled?: boolean;
  asChild?: boolean;
  className?: string;
};

/** Menus render their content in place, always open, so items can be found and chosen. */
export const dropdownMenu = {
  DropdownMenu: ({ children }: Children) => <>{children}</>,
  DropdownMenuTrigger: ({ children }: Children) => <>{children}</>,
  DropdownMenuContent: ({ children }: Children) => <div role="menu">{children}</div>,
  DropdownMenuItem: ({ children, onSelect, disabled, asChild }: ItemProps) =>
    asChild ? (
      <>{children}</>
    ) : (
      <div
        role="menuitem"
        tabIndex={-1}
        aria-disabled={disabled || undefined}
        onClick={() => {
          if (!disabled) onSelect?.(new Event("select"));
        }}
        onKeyDown={() => {}}
      >
        {children}
      </div>
    ),
  DropdownMenuCheckboxItem: ({
    children,
    checked,
    onCheckedChange,
  }: Children & { checked?: boolean; onCheckedChange?: (checked: boolean) => void }) => (
    <div
      role="menuitemcheckbox"
      tabIndex={-1}
      aria-checked={Boolean(checked)}
      onClick={() => onCheckedChange?.(!checked)}
      onKeyDown={() => {}}
    >
      {children}
    </div>
  ),
  DropdownMenuLabel: ({ children }: Children) => <div>{children}</div>,
  DropdownMenuSeparator: () => <hr />,
  DropdownMenuRadioGroup: ({ children }: Children) => <>{children}</>,
  DropdownMenuRadioItem: ({ children }: Children) => <div>{children}</div>,
};

/** A plain open/close panel standing in for Radix's popover. */
export const popover = (() => {
  const Context = React.createContext<{ open: boolean; set: (open: boolean) => void }>({
    open: false,
    set: () => {},
  });
  return {
    Popover: ({
      open,
      onOpenChange,
      children,
    }: { open: boolean; onOpenChange: (open: boolean) => void } & Children) => (
      <Context.Provider value={{ open, set: onOpenChange }}>{children}</Context.Provider>
    ),
    PopoverTrigger: ({ children }: { children: React.ReactElement<{ onClick?: () => void }> }) => {
      const { open, set } = React.useContext(Context);
      return React.cloneElement(children, { onClick: () => set(!open) });
    },
    PopoverContent: ({ children }: Children) => {
      const { open } = React.useContext(Context);
      return open ? <dialog open>{children}</dialog> : null;
    },
  };
})();
