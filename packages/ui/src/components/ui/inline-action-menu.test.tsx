import { fireEvent, render, screen } from "@testing-library/react";
import type * as React from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { InlineActionMenu } from "./inline-action-menu.js";

/**
 * The menu primitive closes itself after a select event unless the handler cancels it. Opening a
 * real Radix menu in jsdom is slow, so the primitive is replaced by a thin stand-in that hands
 * each item a cancellable select event, and the tests check that the menu leaves it uncancelled.
 */
vi.mock("./dropdown-menu.js", () => ({
  DropdownMenu: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  DropdownMenuTrigger: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  DropdownMenuContent: ({ children }: { children: React.ReactNode }) => (
    <div role="menu">{children}</div>
  ),
  DropdownMenuSeparator: () => <hr />,
  DropdownMenuItem: ({
    children,
    className,
    disabled,
    onSelect,
  }: {
    children: React.ReactNode;
    className?: string;
    disabled?: boolean;
    onSelect?: (event: Event) => void;
  }) => (
    <div
      role="menuitem"
      tabIndex={-1}
      className={className}
      aria-disabled={disabled || undefined}
      onClick={() => {
        if (disabled) return;
        const event = new Event("menu.itemSelect", { cancelable: true });
        onSelect?.(event);
        lastSelect = event;
      }}
      onKeyDown={() => {}}
    >
      {children}
    </div>
  ),
}));

let lastSelect: Event | null = null;

/** Frames queued while the test runs, flushed by hand instead of waiting for real ones. */
let frames: FrameRequestCallback[] = [];
function flushFrames() {
  const queued = frames;
  frames = [];
  for (const cb of queued) cb(0);
}

describe("InlineActionMenu", () => {
  beforeEach(() => {
    frames = [];
    lastSelect = null;
    vi.stubGlobal("requestAnimationFrame", (cb: FrameRequestCallback) => frames.push(cb));
  });
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("lets the menu close when an item is chosen, then runs the item on the next frame", () => {
    const onRemove = vi.fn();
    render(
      <InlineActionMenu
        label="More for Lena Fischer"
        items={[
          { type: "item", label: "Transfer ownership", onSelect: vi.fn() },
          { type: "separator" },
          { type: "item", label: "Remove", onSelect: onRemove, destructive: true },
        ]}
      />,
    );
    expect(screen.getByRole("button", { name: "More for Lena Fischer" })).toBeInTheDocument();

    fireEvent.click(screen.getByRole("menuitem", { name: "Remove" }));

    // Not cancelled, so the menu closes and focus goes back to the trigger first.
    expect(lastSelect?.defaultPrevented).toBe(false);
    expect(onRemove).not.toHaveBeenCalled();
    flushFrames();
    expect(onRemove).toHaveBeenCalledOnce();
  });

  it("draws a destructive item in the error colour", () => {
    render(
      <InlineActionMenu
        label="More"
        items={[
          { type: "item", label: "Resend", onSelect: vi.fn() },
          { type: "item", label: "Withdraw", onSelect: vi.fn(), destructive: true },
        ]}
      />,
    );
    const item = screen.getByRole("menuitem", { name: "Withdraw" });
    expect(item.className).toContain("text-error");
    expect(item.className).toContain("focus:text-error");
    expect(item.className).not.toContain("live-red");
    expect(screen.getByRole("menuitem", { name: "Resend" }).className).toBe("");
  });

  it("does not run a disabled item", () => {
    const onResend = vi.fn();
    render(
      <InlineActionMenu
        label="More"
        items={[{ type: "item", label: "Resend", onSelect: onResend, disabled: true }]}
      />,
    );
    fireEvent.click(screen.getByRole("menuitem", { name: "Resend" }));
    flushFrames();
    expect(onResend).not.toHaveBeenCalled();
  });
});
