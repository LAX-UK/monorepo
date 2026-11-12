import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { type EntityOption, EntityPicker } from "./entity-picker.js";

const free: EntityOption = {
  id: "a1",
  label: "Evening Tide",
  description: "Hannah Cole",
  leading: <span data-testid="thumb-a1" />,
  group: "Can be held",
};
const locked: EntityOption = {
  id: "a2",
  label: "Tide Study III",
  description: "Hannah Cole",
  disabledReason: "This artwork is live on lax.art. Take it off lax.art first.",
  group: "Can't be held now",
};

function open() {
  fireEvent.click(screen.getByRole("combobox"));
}

describe("EntityPicker", () => {
  it("draws the leading element and group headings in the list", () => {
    render(<EntityPicker value={null} onValueChange={vi.fn()} options={[free, locked]} />);
    open();
    expect(screen.getByTestId("thumb-a1")).toBeInTheDocument();
    expect(screen.getByText("Can be held")).toBeInTheDocument();
    expect(screen.getByText("Can't be held now")).toBeInTheDocument();
  });

  it("shows the chosen option's thumbnail in the closed control", () => {
    render(<EntityPicker value="a1" onValueChange={vi.fn()} options={[free]} />);
    expect(within(screen.getByRole("combobox")).getByTestId("thumb-a1")).toBeInTheDocument();
  });

  it("shows a locked option's reason, describes the option with it and never chooses it", () => {
    const change = vi.fn();
    render(<EntityPicker value={null} onValueChange={change} options={[free, locked]} />);
    open();
    const option = screen.getByRole("option", { name: /Tide Study III/ });
    expect(option).toHaveAttribute("aria-disabled", "true");
    const reason = within(option).getByText(/live on lax\.art/);
    expect(option.getAttribute("aria-describedby")).toBe(reason.closest("p")?.id);
    fireEvent.click(option);
    expect(change).not.toHaveBeenCalled();
    // The list stays open so the person can pick another one.
    expect(screen.getByRole("listbox")).toBeInTheDocument();
  });

  it("skips a locked option with the arrow keys, so Enter never lands on it", () => {
    const change = vi.fn();
    render(<EntityPicker value={null} onValueChange={change} options={[locked, free]} />);
    open();
    const input = screen.getByPlaceholderText("Search…");
    expect(screen.getByRole("option", { name: /Evening Tide/ })).toHaveAttribute(
      "data-selected",
      "true",
    );
    fireEvent.keyDown(input, { key: "ArrowDown" });
    fireEvent.keyDown(input, { key: "Enter" });
    expect(change).toHaveBeenCalledWith(free);
  });

  it("chooses an available option with Enter", () => {
    const change = vi.fn();
    render(<EntityPicker value={null} onValueChange={change} options={[free, locked]} />);
    open();
    fireEvent.keyDown(screen.getByPlaceholderText("Search…"), { key: "Enter" });
    expect(change).toHaveBeenCalledWith(free);
  });

  it("says what is searching, what failed and lets the person try again", async () => {
    const search = vi
      .fn<(q: string) => Promise<readonly EntityOption[]>>()
      .mockRejectedValueOnce(new Error("down"))
      .mockResolvedValue([free]);
    render(
      <EntityPicker
        value={null}
        onValueChange={vi.fn()}
        search={search}
        searchingText="Searching the register…"
        searchErrorText="Couldn't search the register. Try again in a moment."
      />,
    );
    open();
    expect(screen.getByText("Searching the register…")).toBeInTheDocument();
    expect(await screen.findByText(/Couldn't search the register/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Try again" }));
    await waitFor(() => expect(screen.getByRole("option", { name: /Evening Tide/ })).toBeVisible());
  });

  it("explains an empty result with what was typed, and shows the footer note under results", async () => {
    const search = vi.fn<(q: string) => Promise<readonly EntityOption[]>>().mockResolvedValue([]);
    const { rerender } = render(
      <EntityPicker
        value={null}
        onValueChange={vi.fn()}
        search={search}
        emptyText={(q) => `No original matches "${q}"`}
        footer="Originals only."
      />,
    );
    open();
    fireEvent.change(screen.getByPlaceholderText("Search…"), {
      target: { value: "tidal" },
    });
    expect(await screen.findByText('No original matches "tidal"')).toBeInTheDocument();
    rerender(
      <EntityPicker
        value={null}
        onValueChange={vi.fn()}
        search={search}
        emptyText="None"
        footer="Originals only."
      />,
    );
    expect(screen.getByText("Originals only.")).toBeInTheDocument();
  });
});
