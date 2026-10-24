import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import type * as React from "react";
import { describe, expect, it, vi } from "vitest";

vi.mock("@auction/ui/components/tooltip", () => ({
  TooltipProvider: ({ children }: { children: React.ReactNode }) => children,
  Tooltip: ({ children }: { children: React.ReactNode }) => children,
  TooltipTrigger: ({ children }: { children: React.ReactNode }) => children,
  TooltipContent: () => null,
}));
vi.mock("@/lib/ui/notify", () => ({ notify: { error: vi.fn() } }));

const { StaffEditableTitle } = await import("./staff-editable-title");

describe("StaffEditableTitle", () => {
  it("keeps the rename button and the rename field outside the page heading", () => {
    render(<StaffEditableTitle value="Blue Study" label="lot" editable onSave={vi.fn()} />);
    const heading = screen.getByRole("heading", { level: 1, name: "Blue Study" });
    const rename = screen.getByRole("button", { name: "Rename lot" });
    expect(heading).not.toContainElement(rename);
    fireEvent.click(rename);
    const field = screen.getByRole("textbox", { name: "Rename lot" });
    expect(screen.getByRole("heading", { level: 1, name: "Blue Study" })).not.toContainElement(
      field,
    );
  });

  it("shows the new name at once and rolls back when saving fails", async () => {
    const onSave = vi.fn().mockResolvedValue({ ok: false, error: "Not allowed" });
    render(<StaffEditableTitle value="Blue Study" label="lot" editable onSave={onSave} />);
    fireEvent.click(screen.getByRole("button", { name: "Rename lot" }));
    fireEvent.change(screen.getByRole("textbox", { name: "Rename lot" }), {
      target: { value: "Blue Study, 1962" },
    });
    fireEvent.submit(
      screen.getByRole("textbox", { name: "Rename lot" }).closest("form") as HTMLFormElement,
    );
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("Blue Study, 1962");
    expect(onSave).toHaveBeenCalledWith("Blue Study, 1962");
    await waitFor(() =>
      expect(screen.getByRole("heading", { level: 1 })).not.toHaveTextContent("1962"),
    );
  });

  it("offers no rename to roles that cannot edit", () => {
    render(<StaffEditableTitle value="Blue Study" label="lot" editable={false} onSave={vi.fn()} />);
    expect(screen.queryByRole("button", { name: "Rename lot" })).not.toBeInTheDocument();
  });
});
