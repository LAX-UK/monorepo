import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { AsyncCombobox } from "./async-combobox.js";

type Hit = { id: string; label: string };

const hits: Hit[] = [
  { id: "a", label: "Alpha" },
  { id: "b", label: "Beta" },
];

describe("AsyncCombobox", () => {
  it("exposes combobox a11y on empty trigger", () => {
    render(
      <AsyncCombobox<Hit>
        value={null}
        onChange={() => {}}
        id="picker"
        aria-invalid
        aria-describedby="desc"
        searchHits={async () => hits}
        resolveHit={async (id) => hits.find((h) => h.id === id) ?? null}
        renderHit={(row) => row.label}
        renderSelected={(row) => row.label}
        placeholder="Pick one"
      />,
    );

    const trigger = screen.getByRole("combobox");
    expect(trigger).toHaveTextContent("Pick one");
    expect(trigger).toHaveAttribute("id", "picker");
    expect(trigger).toHaveAttribute("aria-invalid", "true");
    expect(trigger).toHaveAttribute("aria-describedby", "desc");
  });

  it("allows changing selection without clearing first", async () => {
    const onChange = vi.fn();
    render(
      <AsyncCombobox<Hit>
        value="a"
        onChange={onChange}
        id="picker"
        searchHits={async () => hits}
        resolveHit={async (id) => hits.find((h) => h.id === id) ?? null}
        renderHit={(row) => row.label}
        renderSelected={(row) => <span>{row.label}</span>}
        changeLabel="Change"
      />,
    );

    expect(await screen.findByText("Alpha")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("combobox", { name: "Change" }));
    fireEvent.change(screen.getByPlaceholderText("Search…"), { target: { value: "be" } });

    await waitFor(() => {
      expect(screen.getByRole("option", { name: "Beta" })).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole("option", { name: "Beta" }));
    expect(onChange).toHaveBeenCalledWith("b", hits[1]);
  });

  it("clears the selected value", async () => {
    const onChange = vi.fn();
    render(
      <AsyncCombobox<Hit>
        value="a"
        onChange={onChange}
        searchHits={async () => hits}
        resolveHit={async (id) => hits.find((h) => h.id === id) ?? null}
        renderHit={(row) => row.label}
        renderSelected={(row) => row.label}
      />,
    );

    await screen.findByText("Alpha");
    fireEvent.click(screen.getByRole("button", { name: "Clear" }));
    expect(onChange).toHaveBeenCalledWith(null);
  });
});
