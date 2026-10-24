import { Button } from "@auction/ui/components/button";
import * as React from "react";

/*
 * Stand-ins for the Radix pieces jsdom cannot run (positioning, layout, pointer events). Each keeps
 * the contract the staff screens rely on (open and close, choose, disabled) so a test exercises the
 * screen's own behaviour. Use them from `vi.mock(path, async () => (await import(...)).stub())`.
 */

const PopoverContext = React.createContext<{ open: boolean; set: (open: boolean) => void }>({
  open: false,
  set: () => {},
});

/** A popover whose content renders while it is open, opened by clicking its trigger. */
export function popoverStub() {
  return {
    Popover: ({
      open,
      onOpenChange,
      children,
    }: {
      open?: boolean;
      onOpenChange?: (open: boolean) => void;
      children: React.ReactNode;
    }) => (
      <PopoverContext.Provider value={{ open: Boolean(open), set: onOpenChange ?? (() => {}) }}>
        {children}
      </PopoverContext.Provider>
    ),
    PopoverTrigger: ({ children }: { children: React.ReactElement<{ onClick?: () => void }> }) => {
      const context = React.useContext(PopoverContext);
      return React.cloneElement(children, { onClick: () => context.set(!context.open) });
    },
    PopoverContent: ({ children }: { children: React.ReactNode }) =>
      React.useContext(PopoverContext).open ? <div>{children}</div> : null,
  };
}

const SelectContext = React.createContext<(value: string) => void>(() => {});

/** A select that lists every option, so what is offered can be read, and chooses on click. */
export function selectStub() {
  return {
    Select: ({
      onValueChange,
      children,
    }: {
      onValueChange: (value: string) => void;
      children: React.ReactNode;
    }) => <SelectContext.Provider value={onValueChange}>{children}</SelectContext.Provider>,
    SelectTrigger: ({ id, children }: { id?: string; children: React.ReactNode }) => (
      // biome-ignore lint/a11y/useSemanticElements: the select-only combobox pattern, as the real trigger renders it
      // biome-ignore lint/a11y/useAriaPropsForRole: a stand-in; the real trigger wires aria-controls
      <Button type="button" role="combobox" id={id} aria-expanded="false">
        {children}
      </Button>
    ),
    SelectValue: ({ placeholder }: { placeholder?: string }) => <span>{placeholder}</span>,
    SelectContent: ({ children }: { children: React.ReactNode }) => (
      // biome-ignore lint/a11y/useSemanticElements: the listbox of a Radix select
      // biome-ignore lint/a11y/useFocusableInteractive: a stand-in, read but not navigated
      <div role="listbox" tabIndex={-1}>
        {children}
      </div>
    ),
    SelectItem: ({ value, children }: { value: string; children: React.ReactNode }) => {
      const choose = React.useContext(SelectContext);
      return (
        // biome-ignore lint/a11y/useKeyWithClickEvents: a test stand-in for a Radix select item
        // biome-ignore lint/a11y/useSemanticElements: the option of a Radix select
        <div role="option" aria-selected="false" tabIndex={-1} onClick={() => choose(value)}>
          {children}
        </div>
      );
    },
  };
}

/** A tooltip that only renders its trigger. */
export function tooltipStub() {
  return {
    TooltipProvider: ({ children }: { children: React.ReactNode }) => children,
    Tooltip: ({ children }: { children: React.ReactNode }) => children,
    TooltipTrigger: ({ children }: { children: React.ReactNode }) => children,
    TooltipContent: () => null,
  };
}

/** What the search list measures about itself, which jsdom does not implement. */
export function installLayoutStubs() {
  globalThis.ResizeObserver ??= class {
    observe() {}
    unobserve() {}
    disconnect() {}
  };
  Element.prototype.scrollIntoView ??= () => {};
  window.matchMedia ??= (query: string) =>
    ({
      matches: false,
      media: query,
      addEventListener: () => {},
      removeEventListener: () => {},
    }) as unknown as MediaQueryList;
}
