import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

vi.mock("@auction/ui/components/sheet", () =>
  import("../test/radix-stubs.js").then((m) => m.sheet),
);
vi.mock("@auction/ui/components/popover", () =>
  import("../test/radix-stubs.js").then((m) => m.popover),
);
vi.mock("@auction/ui/components/tooltip", () =>
  import("../test/radix-stubs.js").then((m) => m.tooltip),
);

const { FilterSheet } = await import("./filter-sheet.js");

const sections = [
  {
    kind: "checklist" as const,
    id: "status",
    label: "Status",
    options: [
      { value: "pending", label: "Pending", count: 4 },
      { value: "captured", label: "Captured", count: 12 },
    ],
    value: ["pending"],
  },
  {
    kind: "radio" as const,
    id: "hold",
    label: "Hold reason",
    options: [
      { value: "finance", label: "Finance" },
      { value: "compliance", label: "Compliance" },
    ],
    value: "",
  },
  {
    kind: "date-range" as const,
    id: "created",
    label: "Created",
    value: { from: "", to: "" },
  },
];

describe("FilterSheet", () => {
  it("shows how many filters are on and opens a sheet with every section", () => {
    render(<FilterSheet sections={sections} onApply={() => {}} today="2026-10-24" />);
    const button = screen.getByRole("button", { name: /Filter/ });
    expect(button).toHaveTextContent("Filter1");
    fireEvent.click(button);
    const sheet = screen.getByRole("dialog");
    expect(within(sheet).getByRole("group", { name: "Status" })).toBeInTheDocument();
    expect(within(sheet).getByRole("group", { name: "Hold reason" })).toBeInTheDocument();
    expect(within(sheet).getByRole("group", { name: "Created" })).toBeInTheDocument();
  });

  it("stages choices and applies them once", () => {
    const onApply = vi.fn();
    render(<FilterSheet sections={sections} onApply={onApply} today="2026-10-24" />);
    fireEvent.click(screen.getByRole("button", { name: /Filter/ }));
    fireEvent.click(screen.getByRole("checkbox", { name: /Captured/ }));
    fireEvent.click(screen.getByRole("button", { name: "Last 7 days" }));
    expect(onApply).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Apply filters" }));
    expect(onApply).toHaveBeenCalledTimes(1);
    expect(onApply).toHaveBeenCalledWith({
      status: ["pending", "captured"],
      hold: "",
      created: { from: "2026-10-18", to: "2026-10-24" },
    });
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("picks one record by name for a long list, and counts it as a filter", () => {
    const onApply = vi.fn();
    render(
      <FilterSheet
        sections={[
          {
            kind: "entity",
            id: "saleId",
            label: "Sale",
            value: "",
            options: [
              { id: "sale-1", label: "Autumn Contemporary", description: "Online · 12 Nov 2026" },
              { id: "sale-2", label: "Winter Prints", description: "Gallery · 3 Dec 2026" },
            ],
          },
        ]}
        onApply={onApply}
      />,
    );
    expect(screen.getByRole("button", { name: /Filter/ })).toHaveTextContent(/^Filter$/);
    fireEvent.click(screen.getByRole("button", { name: /Filter/ }));
    fireEvent.click(screen.getByRole("combobox", { name: "Sale" }));
    fireEvent.click(screen.getByRole("option", { name: /Winter Prints/ }));
    expect(screen.getByRole("combobox", { name: "Sale" })).toHaveTextContent("Winter Prints");
    fireEvent.click(screen.getByRole("button", { name: "Apply filters" }));
    expect(onApply).toHaveBeenCalledWith({ saleId: "sale-2" });
  });

  it("clears every section in the draft, and cancel keeps what was applied", () => {
    const onApply = vi.fn();
    render(<FilterSheet sections={sections} onApply={onApply} today="2026-10-24" />);
    fireEvent.click(screen.getByRole("button", { name: /Filter/ }));
    fireEvent.click(screen.getByRole("button", { name: "Clear all" }));
    expect(screen.getByRole("checkbox", { name: /Pending/ })).not.toBeChecked();
    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
    expect(onApply).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: /Filter/ }));
    expect(screen.getByRole("checkbox", { name: /Pending/ })).toBeChecked();
  });
});
