import { fireEvent, render, screen } from "@testing-library/react";
import { type ReactElement, type ReactNode, cloneElement, createContext, useContext } from "react";
import { describe, expect, it, vi } from "vitest";
import { MarketingFilterDropdown } from "./marketing-filter-dropdown.js";

// Radix Popper keeps re-measuring in jsdom and stalls the worker; a minimal controlled popover
// keeps these tests on the dropdown's own contract (draft, Apply, Cancel, trigger name).
vi.mock("@auction/ui/components/popover", () => {
  type Ctx = { open: boolean; onOpenChange: (open: boolean) => void };
  const PopoverContext = createContext<Ctx>({ open: false, onOpenChange: () => {} });
  return {
    Popover: ({ children, ...ctx }: Ctx & { children: ReactNode }) => (
      <PopoverContext.Provider value={ctx}>{children}</PopoverContext.Provider>
    ),
    PopoverTrigger: ({ children }: { children: ReactElement<Record<string, unknown>> }) => {
      const { open, onOpenChange } = useContext(PopoverContext);
      return cloneElement(children, {
        "aria-expanded": open,
        onClick: () => onOpenChange(!open),
      });
    },
    PopoverContent: ({ children }: { children: ReactNode }) => {
      const { open } = useContext(PopoverContext);
      return open ? <div data-testid="popover-content">{children}</div> : null;
    },
  };
});

const OPTIONS = [
  { value: "painting", label: "Paintings" },
  { value: "print", label: "Prints" },
  { value: "sculpture", label: "Sculpture" },
];

function renderDropdown(selected: string[] = [], onApply = vi.fn()) {
  render(
    <MarketingFilterDropdown
      label="Medium"
      idPrefix="medium"
      options={OPTIONS}
      selected={selected}
      onApply={onApply}
    />,
  );
  return onApply;
}

describe("MarketingFilterDropdown", () => {
  it("names the trigger with the applied count", () => {
    renderDropdown(["painting", "print"]);
    expect(screen.getByRole("button", { name: "Medium, 2 selected" })).toHaveTextContent(
      "Medium (2)",
    );
  });

  it("names the trigger with the label alone when nothing is applied", () => {
    renderDropdown();
    expect(screen.getByRole("button", { name: "Medium" })).toHaveAttribute(
      "aria-expanded",
      "false",
    );
  });

  it("applies the ticked draft only on Apply", () => {
    const onApply = renderDropdown(["painting"]);
    fireEvent.click(screen.getByRole("button", { name: "Medium, 1 selected" }));

    const group = screen.getByRole("group", { name: "Medium" });
    expect(group).toBeInTheDocument();
    expect(screen.getByRole("checkbox", { name: "Paintings" })).toBeChecked();
    fireEvent.click(screen.getByRole("checkbox", { name: "Sculpture" }));
    fireEvent.click(screen.getByRole("checkbox", { name: "Paintings" }));
    expect(onApply).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole("button", { name: "Apply" }));
    expect(onApply).toHaveBeenCalledWith(["sculpture"]);
    expect(screen.queryByRole("group", { name: "Medium" })).not.toBeInTheDocument();
  });

  it("discards the draft on Cancel and starts from the applied values next time", () => {
    const onApply = renderDropdown(["print"]);
    const trigger = screen.getByRole("button", { name: "Medium, 1 selected" });
    fireEvent.click(trigger);
    fireEvent.click(screen.getByRole("checkbox", { name: "Sculpture" }));
    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
    expect(onApply).not.toHaveBeenCalled();

    fireEvent.click(trigger);
    expect(screen.getByRole("checkbox", { name: "Sculpture" })).not.toBeChecked();
    expect(screen.getByRole("checkbox", { name: "Prints" })).toBeChecked();
    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
  });

  it("renders a radio group for single-value facets", () => {
    const onApply = vi.fn();
    render(
      <MarketingFilterDropdown
        label="Price range"
        idPrefix="price"
        selection="single"
        options={[
          { value: "", label: "Any price" },
          { value: "under-1000", label: "Under £1,000" },
        ]}
        selected={[]}
        onApply={onApply}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: "Price range" }));
    expect(screen.getByRole("radiogroup", { name: "Price range" })).toBeInTheDocument();
    expect(screen.getByRole("radio", { name: "Any price" })).toBeChecked();
    fireEvent.click(screen.getByRole("radio", { name: "Under £1,000" }));
    fireEvent.click(screen.getByRole("button", { name: "Apply" }));
    expect(onApply).toHaveBeenCalledWith(["under-1000"]);
  });
  it("shows a trigger label in place of the label and count, keeping the heading", () => {
    render(
      <MarketingFilterDropdown
        label="Sort"
        triggerLabel="Sort: Newest"
        idPrefix="sort"
        selection="single"
        options={[
          { value: "newest", label: "Newest" },
          { value: "priceAsc", label: "Price low to high" },
        ]}
        selected={["newest"]}
        onApply={vi.fn()}
      />,
    );
    const trigger = screen.getByRole("button", { name: "Sort: Newest" });
    expect(trigger).toHaveTextContent("Sort: Newest");
    expect(trigger).not.toHaveTextContent("(1)");
    fireEvent.click(trigger);
    expect(screen.getByRole("radiogroup", { name: "Sort" })).toBeInTheDocument();
  });
});
