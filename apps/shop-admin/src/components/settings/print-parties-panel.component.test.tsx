// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import type * as React from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

const addPrintParty = vi.fn();
const removePrintParty = vi.fn();
const refresh = vi.fn();

vi.mock("@/server/application/print-party-actions.server", () => ({
  addPrintParty,
  removePrintParty,
}));
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), refresh, replace: vi.fn() }),
  usePathname: () => "/settings/printers-and-publishers",
}));
vi.mock("sonner", () => ({
  toast: Object.assign(vi.fn(), { success: vi.fn(), error: vi.fn(), warning: vi.fn() }),
}));
vi.mock("@auction/ui/components/dialog", () => ({
  Dialog: ({ open, children }: { open: boolean; children: React.ReactNode }) =>
    open ? <dialog open>{children}</dialog> : null,
  DialogContent: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  DialogTitle: ({ children }: { children: React.ReactNode }) => <h2>{children}</h2>,
  DialogDescription: ({ children }: { children: React.ReactNode }) => <p>{children}</p>,
}));

const { PrintPartiesPanel } = await import("./print-parties-panel.client");

const PARTIES = [
  { id: "00000000-0000-4000-8000-000000000001", name: "Coriander Studio, London" },
  { id: "00000000-0000-4000-8000-000000000002", name: "Kestrel Editions" },
];

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe("the printers and publishers list", () => {
  it("shows an empty list with where the names go", () => {
    render(<PrintPartiesPanel parties={[]} canEdit />);
    expect(screen.getByText("No names yet")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Add name" })).toBeInTheDocument();
  });

  it("lists the names, and gives staff who cannot edit nothing to change", () => {
    render(<PrintPartiesPanel parties={PARTIES} canEdit={false} />);
    expect(screen.getByText("Coriander Studio, London")).toBeInTheDocument();
    expect(screen.getByText("Kestrel Editions")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Add name" })).toBeNull();
    expect(screen.queryByRole("button", { name: /Remove/ })).toBeNull();
  });

  it("adds a trimmed name and clears the field", async () => {
    addPrintParty.mockResolvedValue({ ok: true, data: { id: "x", name: "Fenwick Press" } });
    render(<PrintPartiesPanel parties={PARTIES} canEdit />);
    const field = screen.getByLabelText("Name");
    fireEvent.change(field, { target: { value: "  Fenwick Press  " } });
    fireEvent.click(screen.getByRole("button", { name: "Add name" }));
    await waitFor(() =>
      expect(addPrintParty).toHaveBeenCalledWith(
        expect.objectContaining({ name: "Fenwick Press" }),
      ),
    );
    await waitFor(() => expect(field).toHaveValue(""));
    expect(refresh).toHaveBeenCalled();
  });

  it("refuses a blank name and a name already listed, beside the field", async () => {
    render(<PrintPartiesPanel parties={PARTIES} canEdit />);
    fireEvent.click(screen.getByRole("button", { name: "Add name" }));
    expect(await screen.findByText("Enter a name")).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText("Name"), { target: { value: "kestrel EDITIONS" } });
    expect(await screen.findByText("That name is already in the list")).toBeInTheDocument();
    expect(addPrintParty).not.toHaveBeenCalled();
  });

  it("asks before removing, and says saved facts keep the name", async () => {
    removePrintParty.mockResolvedValue({ ok: true, data: undefined });
    render(<PrintPartiesPanel parties={PARTIES} canEdit />);
    fireEvent.click(screen.getByRole("button", { name: "Remove Kestrel Editions" }));
    expect(screen.getByText("Remove Kestrel Editions?")).toBeInTheDocument();
    expect(screen.getByText(/already use it keep the name/)).toBeInTheDocument();
    expect(removePrintParty).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Remove name" }));
    await waitFor(() =>
      expect(removePrintParty).toHaveBeenCalledWith(
        expect.objectContaining({ id: PARTIES[1]?.id }),
      ),
    );
  });
});
