import { TooltipProvider } from "@auction/ui/components/tooltip";
import { PlainLink } from "@auction/ui/lax";
import { fireEvent, render, screen } from "@testing-library/react";
import type * as React from "react";
import { describe, expect, it, vi } from "vitest";
import { RecordPager, recordPosition } from "./record-pager.js";
import { StaffShortcutsProvider } from "./shortcuts.js";

function pager(props: Partial<React.ComponentProps<typeof RecordPager>> = {}) {
  const navigate = vi.fn();
  render(
    <TooltipProvider>
      <StaffShortcutsProvider helpShortcut={false}>
        <RecordPager
          position={2}
          total={12}
          previousHref="/a"
          nextHref="/c"
          noun="thread"
          Link={PlainLink}
          navigate={navigate}
          {...props}
        />
      </StaffShortcutsProvider>
    </TooltipProvider>,
  );
  return navigate;
}

describe("RecordPager", () => {
  it("finds a record's place in its list", () => {
    expect(recordPosition(["a", "b", "c"], "b")).toEqual({
      position: 2,
      total: 3,
      previousId: "a",
      nextId: "c",
    });
    expect(recordPosition(["a"], "z")).toBeNull();
  });

  it("moves with J and K through the kit's registry", () => {
    const navigate = pager();
    expect(screen.getByText("of 12", { exact: false })).toBeTruthy();
    fireEvent.keyDown(document.body, { key: "j" });
    expect(navigate).toHaveBeenCalledWith("/c");
  });

  it("leaves J and K to the app when its shortcuts are off", () => {
    const navigate = pager({ shortcuts: false });
    fireEvent.keyDown(document.body, { key: "j" });
    fireEvent.keyDown(document.body, { key: "k" });
    expect(navigate).not.toHaveBeenCalled();
    expect(screen.getByRole("link", { name: "Next thread" }).getAttribute("href")).toBe("/c");
  });
});
