import { type DataColumn, PrimaryCell, type StaffLinkComponent } from "@auction/staff-ui";
import { fireEvent, render, screen, within } from "@testing-library/react";
import { type MockInstance, afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { RelatedRecordsSection } from "./related-records-section";

type Bid = { id: string; lot: string; lotId: string | null };
const bids: Bid[] = [
  { id: "b1", lot: "Blue study", lotId: "lot_1" },
  { id: "b2", lot: "Withdrawn lot", lotId: null },
];
const lotHref = (bid: Bid) => (bid.lotId ? `/admin/lots/${bid.lotId}` : null);

function setup() {
  const visit = vi.fn();
  // Navigates as the app's Link does: a plain click is the router's, the rest the browser's.
  const RouterLink: StaffLinkComponent = ({ href, onClick, children, ...rest }) => (
    <a
      href={href}
      {...rest}
      onClick={(event) => {
        onClick?.(event);
        const modified = event.metaKey || event.ctrlKey || event.shiftKey || event.altKey;
        if (event.defaultPrevented || modified || event.button !== 0) return;
        event.preventDefault();
        visit(href);
      }}
    >
      {children}
    </a>
  );
  const columns: DataColumn<Bid>[] = [
    {
      id: "lot",
      header: "Lot",
      mobile: "title",
      cell: (bid) => {
        const href = lotHref(bid);
        return href ? (
          <PrimaryCell href={href} Link={RouterLink}>
            {bid.lot}
          </PrimaryCell>
        ) : (
          bid.lot
        );
      },
    },
    { id: "note", header: "Note", cell: (bid) => `Note for ${bid.lot}` },
  ];
  render(
    <RelatedRecordsSection<Bid>
      title="Bids"
      label="Bids"
      columns={columns}
      data={bids}
      getRowId={(bid) => bid.id}
      rowHref={lotHref}
      defaultSort={{ columnId: "lot", direction: "asc" }}
      empty={{ title: "No bids yet", description: "Bids appear here." }}
    />,
  );
  return { visit };
}

let open: MockInstance<typeof window.open>;
beforeEach(() => {
  open = vi.spyOn(window, "open").mockImplementation(() => null);
});
afterEach(() => {
  open.mockRestore();
  window.history.replaceState(null, "", "/");
});

describe("RelatedRecordsSection rowHref: a related row opens its record", () => {
  it("follows the record's link on a click anywhere on the row", () => {
    const { visit } = setup();
    fireEvent.click(screen.getByText("Note for Blue study"));
    expect(visit).toHaveBeenCalledWith("/admin/lots/lot_1");
  });

  it("opens the record in a new tab on Cmd-click and middle-click", () => {
    const { visit } = setup();
    const cell = screen.getByText("Note for Blue study");
    fireEvent.click(cell, { metaKey: true });
    fireEvent(cell, new MouseEvent("auxclick", { bubbles: true, cancelable: true, button: 1 }));
    expect(open).toHaveBeenCalledTimes(2);
    expect(open).toHaveBeenCalledWith("/admin/lots/lot_1", "_blank", "noopener");
    expect(visit).not.toHaveBeenCalled();
  });

  it("leaves a row with no page alone", () => {
    const { visit } = setup();
    const row = screen.getByText("Note for Withdrawn lot").closest("tr") as HTMLElement;
    expect(within(row).queryByRole("link")).toBeNull();
    fireEvent.click(within(row).getByText("Note for Withdrawn lot"));
    fireEvent.click(within(row).getByText("Note for Withdrawn lot"), { metaKey: true });
    expect(visit).not.toHaveBeenCalled();
    expect(open).not.toHaveBeenCalled();
  });
});
