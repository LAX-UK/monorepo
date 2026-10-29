import { fireEvent, render, screen } from "@testing-library/react";
import type * as React from "react";
import { describe, expect, it, vi } from "vitest";
import { BUTTON_SIZES, Button } from "./button.js";
import { LoadingButton } from "./loading-button.js";

/**
 * Floating positioning does not settle under jsdom, so an opened Radix tooltip stalls the test
 * worker. This stand-in keeps the controlled open state and renders the content only when open,
 * which is the behaviour the disabled reason relies on; the real tooltip is checked in a browser.
 */
vi.mock("@radix-ui/react-tooltip", async () => {
  const React = await import("react");
  const OpenContext = React.createContext(false);
  return {
    Provider: ({ children }: { children: React.ReactNode }) => children,
    Root: ({ open, children }: { open: boolean; children: React.ReactNode }) => (
      <OpenContext.Provider value={open}>{children}</OpenContext.Provider>
    ),
    Trigger: ({ children }: { children: React.ReactNode }) => children,
    Portal: ({ children }: { children: React.ReactNode }) => children,
    Arrow: () => null,
    Content: React.forwardRef<HTMLDivElement, { children: React.ReactNode }>(({ children }, ref) =>
      React.useContext(OpenContext) ? (
        <div ref={ref} role="tooltip">
          {children}
        </div>
      ) : null,
    ),
  };
});

describe("Button size scale", () => {
  it.each([
    ["sm", "min-h-8", "text-[0.8125rem]", "px-3"],
    ["default", "min-h-9", "text-sm", "px-4"],
    ["lg", "min-h-11", "text-sm", "px-6"],
  ] as const)("%s sets its height, label size and padding together", (size, height, text, pad) => {
    render(<Button size={size}>Save</Button>);
    expect(screen.getByRole("button", { name: "Save" })).toHaveClass(height, text, pad);
  });

  it("gives the three steps three different heights", () => {
    const heights = (["sm", "default", "lg"] as const).map((s) => BUTTON_SIZES[s].split(" ")[0]);
    expect(new Set(heights).size).toBe(3);
  });

  it("never sets a label under 13px on a block size", () => {
    for (const size of ["sm", "default", "lg"] as const) {
      expect(BUTTON_SIZES[size]).not.toContain("text-xs");
    }
  });

  it("is 44px with a 14px label when no size is given, so pages keep their height", () => {
    render(<Button>Save</Button>);
    expect(screen.getByRole("button", { name: "Save" })).toHaveClass("min-h-11", "text-sm");
  });
});

describe("Button disabled", () => {
  it.each([
    "default",
    "primary",
    "destructive",
    "outline",
    "secondaryOutline",
    "ghost",
    "link",
  ] as const)("%s never fades and draws the disabled label when disabled", (variant) => {
    render(
      <Button variant={variant} disabled>
        Save
      </Button>,
    );
    const { className } = screen.getByRole("button", { name: "Save" });
    expect(className).not.toMatch(/opacity/);
    expect(className).toContain(" disabled:text-[color:var(--color-disabled-fg,");
    expect(className).toContain("aria-disabled:text-[color:var(--color-disabled-fg,");
  });

  it.each(["outline", "secondaryOutline"] as const)(
    "%s mutes its edge when disabled",
    (variant) => {
      render(
        <Button variant={variant} disabled>
          Save
        </Button>,
      );
      const { className } = screen.getByRole("button", { name: "Save" });
      expect(className).toContain("disabled:border-[color:var(--color-disabled-border,");
      expect(className).toContain("aria-disabled:border-[color:var(--color-disabled-border,");
    },
  );

  it.each(["default", "primary", "destructive", "secondary"] as const)(
    "%s moves onto the faint disabled fill",
    (variant) => {
      render(
        <Button variant={variant} disabled>
          Save
        </Button>,
      );
      expect(screen.getByRole("button", { name: "Save" }).className).toContain(
        "disabled:bg-[color:var(--color-disabled-bg,",
      );
    },
  );
});

describe("Button disabledReason", () => {
  const reason = "Accept the agreement first";

  it("stays focusable and is disabled with aria-disabled instead of disabled", () => {
    render(<Button disabledReason={reason}>Submit</Button>);
    const button = screen.getByRole("button", { name: "Submit" });
    expect(button).not.toBeDisabled();
    expect(button).toHaveAttribute("aria-disabled", "true");
    button.focus();
    expect(button).toHaveFocus();
  });

  it("reads the reason as the button's description, after any it already has", () => {
    render(
      <>
        <p id="hint">For Northbank Gallery</p>
        <Button disabledReason={reason} aria-describedby="hint">
          Submit
        </Button>
      </>,
    );
    expect(screen.getByRole("button", { name: "Submit" })).toHaveAccessibleDescription(
      `For Northbank Gallery ${reason}`,
    );
  });

  it("does not run its action, submit its form or follow its link when pressed", () => {
    const onClick = vi.fn();
    const onSubmit = vi.fn((event: React.FormEvent) => event.preventDefault());
    render(
      <form onSubmit={onSubmit}>
        <Button type="submit" disabledReason={reason} onClick={onClick}>
          Submit
        </Button>
        <Button asChild disabledReason="Sign in to continue">
          <a href="#next">Continue</a>
        </Button>
      </form>,
    );
    fireEvent.click(screen.getByRole("button", { name: "Submit" }));
    expect(onClick).not.toHaveBeenCalled();
    expect(onSubmit).not.toHaveBeenCalled();
    const link = screen.getByRole("link", { name: "Continue" });
    expect(link).toHaveAttribute("aria-disabled", "true");
    // fireEvent returns false when a handler prevented the default action.
    expect(fireEvent.click(link)).toBe(false);
  });

  it("keeps the reason for screen readers and shows it in a tooltip when pressed", () => {
    render(<Button disabledReason={reason}>Submit</Button>);
    expect(screen.getByText(reason)).toHaveClass("sr-only");
    expect(screen.queryByRole("tooltip")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Submit" }));
    expect(screen.getByRole("tooltip")).toHaveTextContent(reason);
  });

  it("behaves as an ordinary button when the reason is empty", () => {
    const onClick = vi.fn();
    render(
      <Button disabledReason="  " onClick={onClick}>
        Submit
      </Button>,
    );
    const button = screen.getByRole("button", { name: "Submit" });
    expect(button).not.toHaveAttribute("aria-disabled");
    fireEvent.click(button);
    expect(onClick).toHaveBeenCalledOnce();
  });

  it("wins over the native disabled attribute so the reason stays reachable", () => {
    render(
      <Button disabled disabledReason={reason}>
        Submit
      </Button>,
    );
    expect(screen.getByRole("button", { name: "Submit" })).not.toBeDisabled();
  });
});

describe("LoadingButton", () => {
  const layers = () =>
    [...screen.getByRole("button").querySelectorAll(":scope > span > span")] as HTMLElement[];

  it("keeps its label, stays focusable and is not drawn as disabled while loading", () => {
    render(<LoadingButton loading>Save changes</LoadingButton>);
    const button = screen.getByRole("button", { name: "Save changes" });
    expect(button).not.toBeDisabled();
    expect(button).not.toHaveAttribute("aria-disabled");
    expect(button).toHaveAttribute("data-loading", "true");
  });

  it("holds the idle and loading layers in one grid cell, so its width never changes", () => {
    const { rerender } = render(<LoadingButton loadingLabel="Saving…">Save</LoadingButton>);
    expect(layers()).toHaveLength(2);
    for (const layer of layers()) expect(layer).toHaveClass("col-start-1", "row-start-1");
    expect(layers()[1]).toHaveClass("invisible");
    expect(screen.getByRole("button")).toHaveAccessibleName("Save");

    rerender(
      <LoadingButton loading loadingLabel="Saving…">
        Save
      </LoadingButton>,
    );
    expect(layers()[0]).toHaveClass("invisible");
    expect(screen.getByRole("button")).toHaveAccessibleName("Saving…");
  });

  it("only spins while loading", () => {
    const { rerender } = render(<LoadingButton>Save</LoadingButton>);
    expect(screen.getByRole("button").querySelector("svg.animate-spin")).toBeNull();
    rerender(<LoadingButton loading>Save</LoadingButton>);
    expect(screen.getByRole("button").querySelector("svg.animate-spin")).not.toBeNull();
  });

  it("runs its action when it is not loading", () => {
    const onClick = vi.fn();
    render(<LoadingButton onClick={onClick}>Save</LoadingButton>);
    fireEvent.click(screen.getByRole("button", { name: "Save" }));
    expect(onClick).toHaveBeenCalledOnce();
  });
});
