import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/ui/notify", () => ({ notify: { success: vi.fn(), error: vi.fn() } }));

import { LotReminderDialog } from "./lot-reminder-dialog";

const HOUR = 60 * 60 * 1000;
const now = new Date("2026-11-20T12:00:00Z");
const lot = {
  lotId: "lot-1",
  title: "Red chair, evening",
  startsAt: now.getTime() + 6 * HOUR,
  closesAt: now.getTime() + 6 * 24 * HOUR,
  reminder: null,
};

function client() {
  return { set: vi.fn(async () => true), clear: vi.fn(async () => true) };
}

describe("LotReminderDialog", () => {
  it("saves the chosen time with the note", async () => {
    const c = client();
    const onSaved = vi.fn();
    render(
      <LotReminderDialog lot={lot} onOpenChange={vi.fn()} onSaved={onSaved} client={c} now={now} />,
    );
    fireEvent.click(screen.getByRole("radio", { name: /1 hour before it closes/ }));
    fireEvent.change(screen.getByLabelText(/Note/), { target: { value: " Check the frame " } });
    fireEvent.click(screen.getByRole("button", { name: "Save reminder" }));
    await waitFor(() =>
      expect(c.set).toHaveBeenCalledWith("lot-1", {
        kind: "hour_before_close",
        note: "Check the frame",
      }),
    );
    await waitFor(() => expect(onSaved).toHaveBeenCalled());
  });

  it("removes a saved reminder", async () => {
    const c = client();
    render(
      <LotReminderDialog
        lot={{ ...lot, reminder: { kind: "day_before_close", note: "Frame" } }}
        onOpenChange={vi.fn()}
        onSaved={vi.fn()}
        client={c}
        now={now}
      />,
    );
    expect(screen.getByRole("radio", { name: /1 day before it closes/ })).toBeChecked();
    fireEvent.click(screen.getByRole("button", { name: "Remove reminder" }));
    await waitFor(() => expect(c.clear).toHaveBeenCalledWith("lot-1"));
  });

  it("says when a save fails and stays open", async () => {
    const c = { set: vi.fn(async () => false), clear: vi.fn() };
    const onOpenChange = vi.fn();
    render(
      <LotReminderDialog
        lot={lot}
        onOpenChange={onOpenChange}
        onSaved={vi.fn()}
        client={c}
        now={now}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: "Save reminder" }));
    expect(
      await screen.findByText("We couldn't save the reminder. Try again in a moment."),
    ).toBeInTheDocument();
    expect(onOpenChange).not.toHaveBeenCalledWith(false);
  });
});
