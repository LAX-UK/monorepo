import { render } from "@testing-library/react";
import type * as React from "react";
import { describe, expect, it, vi } from "vitest";

const rootProps = vi.hoisted(() => [] as Array<{ modal?: boolean }>);

// Radix menus position and trap focus slowly in jsdom; the contract under test is the mode the
// kit opens them in, so the root records its props and the rest render in place.
vi.mock("@auction/ui/components/dropdown-menu", async () => {
  const stubs = (await import("../test/radix-stubs.js")).dropdownMenu;
  return {
    ...stubs,
    DropdownMenu: (props: { modal?: boolean; children?: React.ReactNode }) => {
      rootProps.push({ ...(props.modal !== undefined ? { modal: props.modal } : {}) });
      return <>{props.children}</>;
    },
  };
});

const { StaffMenu, StaffMenuContent, StaffMenuItem, StaffMenuTrigger } = await import("./menu.js");
const { OverflowMenu } = await import("../shell/overflow-menu.js");

describe("StaffMenu", () => {
  it("opens non-modal, so the page behind a menu is never hidden from assistive technology", () => {
    rootProps.length = 0;
    render(
      <>
        <StaffMenu>
          <StaffMenuTrigger>Display</StaffMenuTrigger>
          <StaffMenuContent>
            <StaffMenuItem>Compact</StaffMenuItem>
          </StaffMenuContent>
        </StaffMenu>
        <OverflowMenu label="Actions for payment" actions={[{ id: "a", label: "Open" }]} />
      </>,
    );
    expect(rootProps).toEqual([{ modal: false }, { modal: false }]);
  });

  it("lets a menu that must hold focus ask for a modal layer", () => {
    rootProps.length = 0;
    render(
      <StaffMenu modal>
        <StaffMenuTrigger>Account</StaffMenuTrigger>
        <StaffMenuContent>
          <StaffMenuItem>Sign out</StaffMenuItem>
        </StaffMenuContent>
      </StaffMenu>,
    );
    expect(rootProps).toEqual([{ modal: true }]);
  });
});

describe("StaffTooltipProvider", () => {
  it("lets a kit tooltip render outside the shell", async () => {
    const { StaffTooltip, StaffTooltipProvider } = await import("./menu.js");
    const { getByRole } = render(
      <StaffTooltipProvider>
        <StaffTooltip label="Copy ID">
          <button type="button">Copy</button>
        </StaffTooltip>
      </StaffTooltipProvider>,
    );
    expect(getByRole("button", { name: "Copy" })).toBeTruthy();
  });
});
