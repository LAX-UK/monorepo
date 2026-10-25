/*
 * Stand-ins for the Radix sheet and dialog in jsdom, matching the shared staff-ui stubs. They keep
 * the open and close contracts, so a test exercises the Shop component's own behaviour. Use with
 * `vi.mock("@auction/ui/components/sheet", async () => (await import("@/test/radix-stubs")).sheet)`.
 */
import type * as React from "react";

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
