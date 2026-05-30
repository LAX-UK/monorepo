import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import * as React from "react";
import { describe, expect, it, vi } from "vitest";
import { AsyncCombobox } from "./async-combobox.js";

type Hit = { id: string; label: string };

const hits: Hit[] = [
  { id: "a", label: "Alpha" },
  { id: "b", label: "Beta" },
];

describe("AsyncCombobox", () => {
  it("exposes combobox a11y on empty trigger", async () => {
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

    const trigger = await screen.findByRole("combobox");
    expect(trigger).toHaveTextContent("Pick one");
    expect(trigger).toHaveAttribute("id", "picker");
    expect(trigger).toHaveAttribute("aria-invalid", "true");
    expect(trigger).toHaveAttribute("aria-describedby", "desc");
  });

  it("selects from empty state without remounting the picker shell", async () => {
    const onChange = vi.fn();
    function Picker({ value }: { value: string | null }) {
      return (
        <AsyncCombobox<Hit>
          value={value}
          onChange={onChange}
          searchHits={async () => hits}
          resolveHit={async (id) => hits.find((h) => h.id === id) ?? null}
          renderHit={(row) => row.label}
          renderSelected={(row) => <span>{row.label}</span>}
          placeholder="Pick one"
          minQueryLen={0}
        />
      );
    }

    const { rerender } = render(<Picker value={null} />);

    fireEvent.click(await screen.findByRole("combobox"));

    await waitFor(() => {
      expect(screen.getByRole("option", { name: "Alpha" })).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole("option", { name: "Alpha" }));
    await waitFor(() => {
      expect(onChange).toHaveBeenCalledWith("a", hits[0]);
    });

    rerender(<Picker value="a" />);
    expect(await screen.findByText("Alpha")).toBeInTheDocument();
    expect(screen.getByRole("combobox", { name: "Change" })).toBeInTheDocument();
  });

  it("selects from empty state with synchronous parent update without infinite loop", async () => {
    function ControlledPicker() {
      const [value, setValue] = React.useState<string | null>(null);
      return (
        <AsyncCombobox<Hit>
          value={value}
          onChange={(id) => setValue(id)}
          searchHits={async () => hits}
          resolveHit={async (id) => hits.find((h) => h.id === id) ?? null}
          renderHit={(row) => row.label}
          renderSelected={(row) => <span>{row.label}</span>}
          placeholder="Pick one"
          minQueryLen={0}
        />
      );
    }

    render(<ControlledPicker />);

    fireEvent.click(await screen.findByRole("combobox"));

    await waitFor(() => {
      expect(screen.getByRole("option", { name: "Alpha" })).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole("option", { name: "Alpha" }));

    await waitFor(() => {
      expect(screen.getByText("Alpha")).toBeInTheDocument();
    });
    expect(screen.getByRole("combobox", { name: "Change" })).toBeInTheDocument();
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
    await waitFor(() => {
      expect(onChange).toHaveBeenCalledWith("b", hits[1]);
    });
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
    await waitFor(() => {
      expect(onChange).toHaveBeenCalledWith(null);
    });
  });
});
