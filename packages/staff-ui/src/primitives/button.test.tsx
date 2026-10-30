import { fireEvent, render, screen } from "@testing-library/react";
import type * as React from "react";
import { describe, expect, it, vi } from "vitest";
import { TableSelectionProvider } from "../data/bulk-action-bar.js";
import { OverflowMenu } from "../shell/overflow-menu.js";
import { StaffButton } from "./button.js";

// Positioning is not under test; the stand-in shows the reason on focus like the real tooltip.
vi.mock("@auction/ui/components/tooltip", async () => {
  const ReactModule = await import("react");
  const Open = ReactModule.createContext<[boolean, (open: boolean) => void]>([false, () => {}]);
  return {
    TooltipProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
    Tooltip: ({ children }: { children: React.ReactNode }) => {
      const state = ReactModule.useState(false);
      return <Open.Provider value={state}>{children}</Open.Provider>;
    },
    TooltipTrigger: ({ children }: { children: React.ReactElement<{ onFocus?: () => void }> }) => {
      const [, setOpen] = ReactModule.useContext(Open);
      return ReactModule.cloneElement(children, { onFocus: () => setOpen(true) });
    },
    TooltipContent: ({ children }: { children: React.ReactNode }) => {
      const [open] = ReactModule.useContext(Open);
      return open ? <div role="tooltip">{children}</div> : null;
    },
  };
});

describe("StaffButton", () => {
  it("offers a 44px size for time-pressured actions", () => {
    render(<StaffButton size="lg">Hammer</StaffButton>);
    expect(screen.getByRole("button", { name: "Hammer" }).className).toContain("h-lax-control-lg");
  });

  it("is a real disabled button without a reason", () => {
    render(<StaffButton disabled>Refund</StaffButton>);
    expect(screen.getByRole("button", { name: "Refund" })).toBeDisabled();
  });

  it("with a reason, stays focusable, ignores presses and says why", () => {
    const onClick = vi.fn();
    render(
      <StaffButton disabledReason="Refunds open once payment settles." onClick={onClick}>
        Refund
      </StaffButton>,
    );
    const button = screen.getByRole("button", { name: "Refund" });
    expect(button).not.toBeDisabled();
    expect(button).toHaveAttribute("aria-disabled", "true");
    fireEvent.click(button);
    expect(onClick).not.toHaveBeenCalled();
    fireEvent.focus(button);
    expect(screen.getByRole("tooltip")).toHaveTextContent("Refunds open once payment settles.");
  });

  it("keeps its colours and blocks repeat presses while loading", () => {
    const onClick = vi.fn();
    render(
      <StaffButton loading onClick={onClick}>
        Save
      </StaffButton>,
    );
    const button = screen.getByRole("button", { name: "Save" });
    expect(button).toHaveAttribute("aria-busy", "true");
    fireEvent.click(button);
    expect(onClick).not.toHaveBeenCalled();
  });
});

describe("OverflowMenu in a table with rows selected", () => {
  it("steps aside and says why, so only the bulk actions are on offer", () => {
    render(
      <TableSelectionProvider value>
        <OverflowMenu actions={[{ id: "copy", label: "Copy ID", onSelect: () => {} }]} />
      </TableSelectionProvider>,
    );
    const trigger = screen.getByRole("button", { name: "More actions" });
    expect(trigger).toHaveAttribute("aria-disabled", "true");
    fireEvent.focus(trigger);
    expect(screen.getByRole("tooltip")).toHaveTextContent(
      "Clear the selection to use this row's actions",
    );
  });
});
