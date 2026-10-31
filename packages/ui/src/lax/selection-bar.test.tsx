import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { Button, SelectionBar } from "./index.js";

describe("SelectionBar", () => {
  it("is not shown when nothing is picked", () => {
    const { container } = render(
      <SelectionBar count={0} noun={["notification", "notifications"]} onClear={() => {}}>
        <Button>Archive</Button>
      </SelectionBar>,
    );
    expect(container).toBeEmptyDOMElement();
  });

  it("says how many are picked, with the actions and a way to clear", () => {
    const onClear = vi.fn();
    const { rerender } = render(
      <SelectionBar count={1} noun={["notification", "notifications"]} onClear={onClear}>
        <Button>Archive</Button>
      </SelectionBar>,
    );
    expect(screen.getByRole("region", { name: "Selected notifications" })).toHaveTextContent(
      "1 notification selected",
    );
    rerender(
      <SelectionBar count={3} noun={["notification", "notifications"]} onClear={onClear}>
        <Button>Archive</Button>
      </SelectionBar>,
    );
    expect(screen.getByText("3 notifications selected")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Clear selection" }));
    expect(onClear).toHaveBeenCalledOnce();
    expect(screen.getByRole("button", { name: "Archive" })).toBeInTheDocument();
  });
});
