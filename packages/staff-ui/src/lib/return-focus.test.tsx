import { returnFocusTarget } from "@auction/ui/lax";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import * as React from "react";
import { describe, expect, it } from "vitest";
import { FilterSheet } from "../data/filter-sheet.js";
import { DetailPanel } from "../panels/detail-panel.js";
import { StaffDialog } from "../panels/staff-dialog.js";

function DialogFromButton() {
  const [open, setOpen] = React.useState(false);
  return (
    <>
      <button type="button" onClick={() => setOpen(true)}>
        Change role
      </button>
      <StaffDialog
        open={open}
        onOpenChange={setOpen}
        title="Change role"
        footer={
          <button type="button" onClick={() => setOpen(false)}>
            Cancel
          </button>
        }
      />
    </>
  );
}

describe("returning focus when an overlay closes", () => {
  it("puts focus back on the button that opened a dialog, on Escape and on Cancel", async () => {
    render(<DialogFromButton />);
    const trigger = screen.getByRole("button", { name: "Change role" });

    trigger.focus();
    fireEvent.click(trigger);
    await screen.findByRole("dialog");
    fireEvent.keyDown(screen.getByRole("dialog"), { key: "Escape" });
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    expect(trigger).toHaveFocus();

    fireEvent.click(trigger);
    fireEvent.click(await screen.findByRole("button", { name: "Cancel" }));
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    expect(trigger).toHaveFocus();
  });

  it("returns to the Filter button when the filter sheet closes", async () => {
    render(
      <FilterSheet
        sections={[
          {
            id: "status",
            label: "Status",
            kind: "radio",
            options: [{ value: "live", label: "Live" }],
            value: "",
          },
        ]}
        onApply={() => {}}
      />,
    );
    const filter = screen.getByRole("button", { name: /Filter/ });
    filter.focus();
    fireEvent.click(filter);
    fireEvent.keyDown(await screen.findByRole("dialog"), { key: "Escape" });
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    expect(filter).toHaveFocus();
  });

  it("returns a panel opened from the URL to the list's active row", async () => {
    function PanelFromUrl() {
      const [open, setOpen] = React.useState(true);
      return (
        <>
          <table>
            <tbody>
              <tr data-active="" tabIndex={-1}>
                <td>Lot 7</td>
              </tr>
            </tbody>
          </table>
          <DetailPanel open={open} onOpenChange={setOpen} title="Lot 7" />
        </>
      );
    }
    render(<PanelFromUrl />);
    fireEvent.keyDown(await screen.findByRole("dialog"), { key: "Escape" });
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    expect(screen.getByRole("row")).toHaveFocus();
  });
});

describe("returnFocusTarget", () => {
  it("resolves a menu item to the button that opened its menu", () => {
    document.body.innerHTML = `
      <button aria-controls="row-menu">Row actions</button>
      <div role="menu" id="row-menu"><div role="menuitem" tabindex="-1">Refund</div></div>`;
    const item = document.querySelector<HTMLElement>('[role="menuitem"]');
    expect(returnFocusTarget(item)?.textContent).toBe("Row actions");
  });

  it("returns nothing when only the page body had focus", () => {
    expect(returnFocusTarget(document.body)).toBeNull();
    expect(returnFocusTarget(null)).toBeNull();
  });
});
