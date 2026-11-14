import { TooltipProvider } from "@auction/ui/components/tooltip";
import { PlainLink } from "@auction/ui/lax";
import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { PrimaryCell } from "../data/cells.js";
import { DataTable } from "../data/data-table.js";
import { StaffShortcutsProvider } from "../shell/shortcuts.js";
import { DetailPanel } from "./detail-panel.js";
import { useQueuePanel } from "./queue-panel.js";

type Hold = { id: string; title: string };
const holds: Hold[] = Array.from({ length: 12 }, (_, index) => ({
  id: `h${index + 1}`,
  title: `Hold ${index + 1}`,
}));
const recordHref = (id: string) => `/holds/${id}`;

function HoldsQueue({ initialId = null }: { initialId?: string | null }) {
  const panel = useQueuePanel({
    param: "hold",
    ids: holds.map((hold) => hold.id),
    initialId,
    noun: "hold",
  });
  // The app loads a record by id, so a link to one that is not on this page still opens.
  const open = panel.openId
    ? (holds.find((hold) => hold.id === panel.openId) ?? { id: panel.openId, title: "Hold 40" })
    : null;
  return (
    <>
      <DataTable
        label="Holds"
        columns={[
          {
            id: "title",
            header: "Hold",
            cell: (row) => (
              <PrimaryCell href={recordHref(row.id)} Link={PlainLink}>
                {row.title}
              </PrimaryCell>
            ),
          },
        ]}
        data={holds}
        getRowId={(row) => row.id}
        rowHref={(row) => recordHref(row.id)}
        onRowOpen={(row) => panel.open(row.id)}
        activeRowId={panel.openId}
      />
      <DetailPanel
        open={open !== null}
        onOpenChange={panel.onOpenChange}
        title={open?.title ?? ""}
        {...(panel.queue ? { queue: panel.queue } : {})}
        {...(open ? { fullPage: { href: recordHref(open.id), Link: PlainLink } } : {})}
        footer={<button type="button">Release hold</button>}
      >
        <p>Why it is held</p>
      </DetailPanel>
    </>
  );
}

function renderQueue(props: { initialId?: string | null; shell?: boolean } = {}) {
  const queue = <HoldsQueue initialId={props.initialId ?? null} />;
  return render(
    <TooltipProvider>
      {props.shell ? (
        <StaffShortcutsProvider helpShortcut={false}>{queue}</StaffShortcutsProvider>
      ) : (
        queue
      )}
    </TooltipProvider>,
  );
}

/** The title link in the table layout (the phone layout renders the same links). */
const titleLink = (title: string) =>
  within(screen.getByRole("grid", { name: "Holds", hidden: true })).getByRole("link", {
    name: title,
    hidden: true,
  });
const rowOf = (title: string) => titleLink(title).closest("tr") as HTMLElement;
const dialog = () => screen.getByRole("dialog");
const address = () => `${window.location.pathname}${window.location.search}`;

beforeEach(() => {
  window.history.replaceState(null, "", "/holds?status=open");
});
afterEach(() => {
  vi.restoreAllMocks();
});

describe("a work queue's panel", () => {
  it("opens from a row with a history entry, so Back closes it", async () => {
    const push = vi.spyOn(window.history, "pushState");
    renderQueue();
    fireEvent.click(titleLink("Hold 3"));
    expect(await screen.findByRole("dialog")).toBeInTheDocument();
    expect(push).toHaveBeenCalledTimes(1);
    expect(address()).toBe("/holds?status=open&hold=h3");

    // Back (or the phone's back gesture).
    act(() => {
      window.history.replaceState(null, "", "/holds?status=open");
      window.dispatchEvent(new PopStateEvent("popstate"));
    });
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
  });

  it('shows its place, "3 of 12", where screen readers hear it change', async () => {
    renderQueue({ initialId: "h3" });
    const position = within(await screen.findByRole("dialog")).getByText(
      (_, element) => element?.hasAttribute("data-staff-queue-position") ?? false,
    );
    expect(position).toHaveTextContent("3 of 12 in this queue");
    expect(position).toHaveAttribute("aria-live", "polite");
  });

  it("steps with J and K without closing or adding history entries", async () => {
    const push = vi.spyOn(window.history, "pushState");
    renderQueue();
    fireEvent.click(titleLink("Hold 3"));
    await screen.findByRole("dialog");
    fireEvent.keyDown(dialog(), { key: "j" });
    expect(within(dialog()).getByRole("heading", { name: "Hold 4" })).toBeInTheDocument();
    expect(address()).toBe("/holds?status=open&hold=h4");
    fireEvent.keyDown(dialog(), { key: "k" });
    fireEvent.keyDown(dialog(), { key: "k" });
    expect(within(dialog()).getByRole("heading", { name: "Hold 2" })).toBeInTheDocument();
    expect(push).toHaveBeenCalledTimes(1);
    // The list marks the record shown, so focus returns to it.
    expect(rowOf("Hold 2")).toHaveAttribute("data-active");
  });

  it("steps through the shell's shortcut registry when there is one", async () => {
    renderQueue({ initialId: "h1", shell: true });
    await screen.findByRole("dialog");
    fireEvent.keyDown(window, { key: "j" });
    expect(within(dialog()).getByRole("heading", { name: "Hold 2" })).toBeInTheDocument();
  });

  it("has previous and next buttons that stop at the ends", async () => {
    renderQueue({ initialId: "h12" });
    const panel = await screen.findByRole("dialog");
    const next = within(panel).getByRole("button", { name: "Next hold" });
    expect(next).toHaveAttribute("aria-disabled", "true");
    expect(next).toHaveAttribute("aria-keyshortcuts", "J");
    fireEvent.click(next);
    expect(within(panel).getByRole("heading", { name: "Hold 12" })).toBeInTheDocument();
    fireEvent.click(within(panel).getByRole("button", { name: "Previous hold" }));
    expect(within(panel).getByRole("heading", { name: "Hold 11" })).toBeInTheDocument();
  });

  it("never steps while typing in a field", async () => {
    renderQueue({ initialId: "h1" });
    const panel = await screen.findByRole("dialog");
    const field = document.createElement("input");
    within(panel).getByText("Why it is held").append(field);
    fireEvent.keyDown(field, { key: "j" });
    expect(within(panel).getByRole("heading", { name: "Hold 1" })).toBeInTheDocument();
  });

  it("closes on Esc, steps back over its history entry and returns focus to the row", async () => {
    const back = vi.spyOn(window.history, "back").mockImplementation(() => {});
    renderQueue();
    // As in a browser, the clicked link has focus as the panel opens.
    titleLink("Hold 5").focus();
    fireEvent.click(titleLink("Hold 5"));
    await screen.findByRole("dialog");
    fireEvent.keyDown(dialog(), { key: "j" });
    fireEvent.keyDown(dialog(), { key: "Escape" });
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    expect(back).toHaveBeenCalledTimes(1);
    expect(rowOf("Hold 6")).toHaveFocus();
  });

  it("clears its param on close when it was opened from a link", async () => {
    const back = vi.spyOn(window.history, "back");
    window.history.replaceState(null, "", "/holds?status=open&hold=h2");
    renderQueue({ initialId: "h2" });
    fireEvent.keyDown(await screen.findByRole("dialog"), { key: "Escape" });
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    expect(back).not.toHaveBeenCalled();
    expect(address()).toBe("/holds?status=open");
  });

  it("reopens from its URL even when the record is not on the page shown", async () => {
    window.history.replaceState(null, "", "/holds?hold=h40");
    renderQueue({ initialId: "h40" });
    const panel = await screen.findByRole("dialog");
    expect(within(panel).getByRole("heading", { name: "Hold 40" })).toBeInTheDocument();
    // Not in the list: no position to show and nothing to step to.
    expect(within(panel).queryByRole("button", { name: "Next hold" })).toBeNull();
  });

  it('offers "Open full page", the record\'s own address', async () => {
    renderQueue({ initialId: "h3" });
    const panel = await screen.findByRole("dialog");
    expect(within(panel).getByRole("link", { name: "Open full page" })).toHaveAttribute(
      "href",
      "/holds/h3",
    );
  });

  it("follows Forward back into the panel", async () => {
    renderQueue();
    act(() => {
      window.history.replaceState(null, "", "/holds?status=open&hold=h7");
      window.dispatchEvent(new PopStateEvent("popstate"));
    });
    expect(
      within(await screen.findByRole("dialog")).getByRole("heading", { name: "Hold 7" }),
    ).toBeInTheDocument();
  });
});
