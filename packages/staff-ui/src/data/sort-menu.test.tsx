import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

vi.mock("@auction/ui/components/dropdown-menu", async () => {
  return (await import("../test/radix-stubs.js")).dropdownMenu;
});

const { SortMenu } = await import("./sort-menu.js");

const OPTIONS = [
  { value: "waiting", label: "Longest waiting" },
  { value: "latest", label: "Latest activity" },
] as const;

describe("SortMenu", () => {
  it("names the order in force on the button", () => {
    render(<SortMenu value="waiting" options={OPTIONS} onChange={() => {}} />);
    expect(screen.getByRole("button", { name: "Sort: Longest waiting" })).toBeTruthy();
  });

  it("marks the current choice and reports a new one", () => {
    const onChange = vi.fn();
    render(<SortMenu value="waiting" options={OPTIONS} onChange={onChange} />);
    const latest = screen.getByRole("menuitemradio", { name: "Latest activity" });
    expect(
      screen.getByRole("menuitemradio", { name: "Longest waiting" }).getAttribute("aria-checked"),
    ).toBe("true");
    fireEvent.click(latest);
    expect(onChange).toHaveBeenCalledWith("latest");
  });
});
