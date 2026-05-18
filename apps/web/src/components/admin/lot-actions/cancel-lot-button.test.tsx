import { renderWithViewer } from "@/test/render-with-viewer";
import { fireEvent, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { CancelLotButton } from "./cancel-lot-button";

vi.mock("@/lib/actions/admin", () => ({
  adminCancelLotResultAction: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: vi.fn() }),
}));

describe("CancelLotButton", () => {
  it("requires typing the lot id before confirm", () => {
    renderWithViewer(<CancelLotButton lotId="abc-lot-id" />);
    fireEvent.click(screen.getByRole("button", { name: "Cancel auction" }));
    expect(screen.getByText(/abc-lot-id/)).toBeInTheDocument();
    const confirmButtons = screen.getAllByRole("button", { name: "Cancel auction" });
    const confirm = confirmButtons.at(-1);
    expect(confirm).toBeDefined();
    expect(confirm).toBeDisabled();
    fireEvent.change(screen.getByRole("textbox"), { target: { value: "abc-lot-id" } });
    expect(confirm).not.toBeDisabled();
  });
});
