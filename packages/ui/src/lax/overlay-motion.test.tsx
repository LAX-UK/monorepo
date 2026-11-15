import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { DialogContent, DialogTitle, Dialog as KitDialog } from "../components/ui/dialog.js";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "../components/ui/dropdown-menu.js";
import { HoverCard, HoverCardContent, HoverCardTrigger } from "../components/ui/hover-card.js";
import { Popover, PopoverContent, PopoverTrigger } from "../components/ui/popover.js";
import { Select, SelectContent, SelectItem, SelectTrigger } from "../components/ui/select.js";
import { Sheet, SheetContent, SheetTitle } from "../components/ui/sheet.js";
import {
  TOOLTIP_OPEN_DELAY_MS,
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "../components/ui/tooltip.js";
import { LaxDensityProvider } from "./density.js";
import { Dialog } from "./dialog.js";

const DEAD =
  /animate-in|animate-out|fade-in-0|fade-out-0|zoom-in-95|zoom-out-95|slide-in-from|slide-out-to/;

function motionNodes(): HTMLElement[] {
  return [...document.querySelectorAll<HTMLElement>("[data-lax-motion]")];
}

describe("overlays carry the kit's motion marker and no dead classes", () => {
  it("popover: float, open", () => {
    render(
      <Popover open>
        <PopoverTrigger>t</PopoverTrigger>
        <PopoverContent>body</PopoverContent>
      </Popover>,
    );
    const node = screen.getByText("body");
    expect(node).toHaveAttribute("data-lax-motion", "float");
    expect(node).toHaveAttribute("data-state", "open");
    expect(node).toHaveAttribute("data-side");
    expect(node.className).not.toMatch(DEAD);
  });

  it("hover card: float, open", () => {
    render(
      <HoverCard open>
        <HoverCardTrigger>t</HoverCardTrigger>
        <HoverCardContent>card</HoverCardContent>
      </HoverCard>,
    );
    const node = screen.getByText("card");
    expect(node).toHaveAttribute("data-lax-motion", "float");
    expect(node.className).not.toMatch(DEAD);
  });

  it("dropdown menu: float, open", () => {
    render(
      <DropdownMenu open>
        <DropdownMenuTrigger>t</DropdownMenuTrigger>
        <DropdownMenuContent>
          <DropdownMenuItem>one</DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>,
    );
    const node = screen.getByRole("menu");
    expect(node).toHaveAttribute("data-lax-motion", "float");
    expect(node).toHaveAttribute("data-state", "open");
  });

  it("select: float, open, with no animate-none override", () => {
    render(
      <Select open value="a">
        <SelectTrigger>t</SelectTrigger>
        <SelectContent>
          <SelectItem value="a">A</SelectItem>
        </SelectContent>
      </Select>,
    );
    const node = screen.getByRole("listbox");
    expect(node).toHaveAttribute("data-lax-motion", "float");
    expect(node.className).not.toContain("animate-none");
  });

  it("tooltip: tip marker, and a 400ms default open delay", () => {
    expect(TOOLTIP_OPEN_DELAY_MS).toBe(400);
    render(
      <TooltipProvider>
        <Tooltip open>
          <TooltipTrigger>t</TooltipTrigger>
          <TooltipContent>hint</TooltipContent>
        </Tooltip>
      </TooltipProvider>,
    );
    const node = motionNodes().find((n) => n.textContent?.includes("hint"));
    expect(node).toHaveAttribute("data-lax-motion", "tip");
    expect(node?.getAttribute("data-state")).toMatch(/open/);
  });

  it("dialog: scrim and panel, open", () => {
    render(
      <KitDialog open>
        <DialogContent>
          <DialogTitle>Title</DialogTitle>
        </DialogContent>
      </KitDialog>,
    );
    const kinds = motionNodes().map((n) => n.getAttribute("data-lax-motion"));
    expect(kinds).toEqual(expect.arrayContaining(["scrim", "dialog"]));
    const panel = screen.getByRole("dialog");
    expect(panel).toHaveAttribute("data-state", "open");
    expect(panel.className).not.toMatch(/duration-300/);
  });

  it.each(["left", "right", "top", "bottom"] as const)("sheet from the %s edge", (side) => {
    render(
      <Sheet open>
        <SheetContent side={side}>
          <SheetTitle>Title</SheetTitle>
        </SheetContent>
      </Sheet>,
    );
    const panel = screen.getByRole("dialog");
    expect(panel).toHaveAttribute("data-lax-motion", "sheet");
    expect(panel).toHaveAttribute("data-side", side);
    expect(panel.className).not.toMatch(/transition-transform|duration-300/);
    expect(document.querySelector('[data-lax-motion="scrim"]')).not.toBeNull();
  });

  it("LAX dialog: scrim and panel, panel keeps its placement for the side slide", () => {
    render(
      <Dialog open onOpenChange={() => {}} title="Edit" placement="side">
        body
      </Dialog>,
    );
    const panel = screen.getByRole("dialog");
    expect(panel).toHaveAttribute("data-lax-motion", "dialog");
    expect(panel).toHaveAttribute("data-placement", "side");
    expect(document.querySelector('[data-lax-motion="scrim"]')).not.toBeNull();
  });

  it("staff layers carry the staff density, so they fade at the staff timings", () => {
    render(
      <LaxDensityProvider density="staff">
        <Popover open>
          <PopoverTrigger>t</PopoverTrigger>
          <PopoverContent>staff body</PopoverContent>
        </Popover>
      </LaxDensityProvider>,
    );
    expect(screen.getByText("staff body")).toHaveAttribute("data-lax-density", "staff");
  });

  it("a layer outside any shell has no density attribute", () => {
    render(
      <Popover open>
        <PopoverTrigger>t</PopoverTrigger>
        <PopoverContent>plain body</PopoverContent>
      </Popover>,
    );
    expect(screen.getByText("plain body")).not.toHaveAttribute("data-lax-density");
    fireEvent.keyDown(document.body, { key: "Escape" });
  });
});
