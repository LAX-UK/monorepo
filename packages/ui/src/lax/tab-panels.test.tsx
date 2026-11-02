import { fireEvent, render, screen } from "@testing-library/react";
import { useState } from "react";
import { describe, expect, it } from "vitest";
import { Tabs } from "./index.js";

const items = [
  {
    id: "a",
    label: "Sale A",
    detail: "Closes in 2 days",
    name: "Sale A, closes in 2 days",
    panel: <p>Panel A</p>,
  },
  { id: "b", label: "Sale B", panel: <p>Panel B</p> },
  { id: "c", label: "Sale C", panel: <p>Panel C</p> },
];

function Harness({ trailing }: { trailing?: boolean }) {
  const [value, setValue] = useState("a");
  return (
    <Tabs
      label="Sales"
      items={items}
      value={value}
      onValueChange={setValue}
      trailing={trailing ? <a href="/all">All sales</a> : undefined}
    />
  );
}

describe("Tabs", () => {
  it("names tabs, marks one selected and links each to its panel", () => {
    render(<Harness />);
    expect(screen.getByRole("tablist", { name: "Sales" })).toBeInTheDocument();
    const tab = screen.getByRole("tab", { name: "Sale A, closes in 2 days" });
    expect(tab).toHaveAttribute("aria-selected", "true");
    expect(tab.getAttribute("aria-controls")).toBe(
      screen.getByRole("tabpanel", { name: "Sale A, closes in 2 days" }).id,
    );
  });

  it("keeps every panel mounted but exposes only the active one", () => {
    render(<Harness />);
    const inertPanels = () =>
      screen.getAllByRole("tabpanel", { hidden: true }).filter((p) => p.hasAttribute("inert"));
    expect(inertPanels()).toHaveLength(2);
    expect(screen.getByText("Panel B")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("tab", { name: "Sale B" }));
    expect(inertPanels().map((p) => p.textContent)).toEqual(["Panel A", "Panel C"]);
  });

  it("moves with arrow keys, Home and End, with one tab stop", () => {
    render(<Harness />);
    const a = screen.getByRole("tab", { name: /Sale A/ });
    fireEvent.keyDown(a, { key: "ArrowLeft" });
    const c = screen.getByRole("tab", { name: "Sale C" });
    expect(c).toHaveAttribute("aria-selected", "true");
    expect(c).toHaveFocus();
    expect(a).toHaveAttribute("tabindex", "-1");
    fireEvent.keyDown(c, { key: "Home" });
    expect(screen.getByRole("tab", { name: /Sale A/ })).toHaveAttribute("aria-selected", "true");
    fireEvent.keyDown(a, { key: "ArrowRight" });
    expect(screen.getByRole("tab", { name: "Sale B" })).toHaveAttribute("aria-selected", "true");
    fireEvent.keyDown(screen.getByRole("tab", { name: "Sale B" }), { key: "End" });
    expect(screen.getByRole("tab", { name: "Sale C" })).toHaveAttribute("aria-selected", "true");
  });

  it("keeps the trailing link outside the tablist", () => {
    render(<Harness trailing />);
    expect(screen.getByRole("tablist").querySelector("a")).toBeNull();
    expect(screen.getAllByText("All sales").length).toBeGreaterThan(0);
  });
});
