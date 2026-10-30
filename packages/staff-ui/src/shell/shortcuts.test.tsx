import { PlainLink, TextInput } from "@auction/ui/lax";
import { act, fireEvent, render, screen, within } from "@testing-library/react";
import type * as React from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { RecordPager, recordPosition } from "./record-pager.js";
import {
  STAFF_SHORTCUTS_STORAGE_KEY,
  StaffShortcutsProvider,
  isTypingTarget,
  useStaffShortcut,
  useStaffShortcuts,
} from "./shortcuts.js";

// Positioning tooltips is not under test, and Radix's tooltip needs a provider and a layout.
vi.mock("@auction/ui/components/tooltip", () => ({
  TooltipProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  Tooltip: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  TooltipTrigger: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  TooltipContent: () => null,
}));

/** The test runtime's own localStorage is not reliably a full Storage; use a plain one. */
beforeEach(() => {
  const entries = new Map<string, string>();
  Object.defineProperty(window, "localStorage", {
    configurable: true,
    value: {
      getItem: (key: string) => entries.get(key) ?? null,
      setItem: (key: string, value: string) => void entries.set(key, String(value)),
      removeItem: (key: string) => void entries.delete(key),
      clear: () => entries.clear(),
    },
  });
});

function Edit({ onEdit }: { onEdit: () => void }) {
  useStaffShortcut({ id: "edit", keys: "e", label: "Edit", group: "Records", handler: onEdit });
  return null;
}

function GoToOrders({ onGo }: { onGo: () => void }) {
  useStaffShortcut({
    id: "go-orders",
    keys: "g o",
    label: "Orders",
    group: "Go to",
    handler: onGo,
  });
  return null;
}

function Toggle() {
  const shortcuts = useStaffShortcuts();
  return (
    <button type="button" onClick={() => shortcuts?.setEnabled(!shortcuts.enabled)}>
      {shortcuts?.enabled ? "Turn off" : "Turn on"}
    </button>
  );
}

function press(key: string, init: KeyboardEventInit = {}, target: EventTarget = document.body) {
  act(() => {
    fireEvent.keyDown(target, { key, ...init });
  });
}

describe("staff shortcuts", () => {
  it("runs a single-key shortcut, but never while typing in a field", () => {
    const onEdit = vi.fn();
    render(
      <StaffShortcutsProvider>
        <Edit onEdit={onEdit} />
        <TextInput aria-label="Note" />
      </StaffShortcutsProvider>,
    );
    press("e");
    expect(onEdit).toHaveBeenCalledTimes(1);
    press("e", {}, screen.getByLabelText("Note"));
    expect(onEdit).toHaveBeenCalledTimes(1);
  });

  it("follows two-key sequences such as g then o", () => {
    const onGo = vi.fn();
    render(
      <StaffShortcutsProvider>
        <GoToOrders onGo={onGo} />
      </StaffShortcutsProvider>,
    );
    press("g");
    press("o");
    expect(onGo).toHaveBeenCalledTimes(1);
    press("o");
    expect(onGo).toHaveBeenCalledTimes(1);
  });

  it("lets people turn single-key shortcuts off, and remembers it", () => {
    const onEdit = vi.fn();
    render(
      <StaffShortcutsProvider>
        <Edit onEdit={onEdit} />
        <Toggle />
      </StaffShortcutsProvider>,
    );
    fireEvent.click(screen.getByRole("button", { name: "Turn off" }));
    press("e");
    expect(onEdit).not.toHaveBeenCalled();
    expect(window.localStorage.getItem(STAFF_SHORTCUTS_STORAGE_KEY)).toBe("off");
  });

  it("opens a searchable sheet of what works right now with ?", () => {
    render(
      <StaffShortcutsProvider>
        <Edit onEdit={() => {}} />
        <GoToOrders onGo={() => {}} />
      </StaffShortcutsProvider>,
    );
    press("?", { shiftKey: true });
    const sheet = screen.getByRole("dialog", { name: "Keyboard shortcuts" });
    expect(within(sheet).getByRole("region", { name: "Records" })).toHaveTextContent("Edit");
    expect(within(sheet).getByRole("region", { name: "Go to" })).toHaveTextContent("Orders");
    fireEvent.change(within(sheet).getByRole("searchbox", { name: "Search shortcuts" }), {
      target: { value: "orders" },
    });
    expect(within(sheet).queryByRole("region", { name: "Records" })).not.toBeInTheDocument();
  });

  it("leaves ? alone when the app keeps its own help", () => {
    render(
      <StaffShortcutsProvider helpShortcut={false}>
        <Edit onEdit={() => {}} />
      </StaffShortcutsProvider>,
    );
    press("?", { shiftKey: true });
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("treats text fields, but not checkboxes, as typing", () => {
    const text = document.createElement("input");
    const box = document.createElement("input");
    box.type = "checkbox";
    expect(isTypingTarget(text)).toBe(true);
    expect(isTypingTarget(box)).toBe(false);
    expect(isTypingTarget(document.createElement("textarea"))).toBe(true);
  });
});

describe("RecordPager", () => {
  it("works out the place of a record in its list", () => {
    expect(recordPosition(["a", "b", "c"], "b")).toEqual({
      position: 2,
      total: 3,
      previousId: "a",
      nextId: "c",
    });
    expect(recordPosition(["a", "b"], "z")).toBeNull();
  });

  it("shows the position, moves with J and K, and stops at the ends", () => {
    const navigate = vi.fn();
    render(
      <StaffShortcutsProvider>
        <RecordPager
          position={1}
          total={50}
          previousHref={null}
          nextHref="/orders/b"
          noun="order"
          Link={PlainLink}
          navigate={navigate}
        />
      </StaffShortcutsProvider>,
    );
    expect(screen.getByRole("navigation", { name: "Position in list" })).toHaveTextContent(
      "1 of 50",
    );
    expect(screen.getByRole("button", { name: "Previous order" })).toBeDisabled();
    expect(screen.getByRole("link", { name: "Next order" })).toHaveAttribute("href", "/orders/b");
    press("j");
    expect(navigate).toHaveBeenCalledWith("/orders/b");
    press("k");
    expect(navigate).toHaveBeenCalledTimes(1);
  });
});
