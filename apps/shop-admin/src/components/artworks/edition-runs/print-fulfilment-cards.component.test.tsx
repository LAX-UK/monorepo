// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

const approveHorsCommerce = vi.fn();

vi.mock("@/server/application/print-fulfilment-actions.server", () => ({
  approveHorsCommerce,
}));
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), refresh: vi.fn() }),
  usePathname: () => "/artworks/a-1",
}));
vi.mock("sonner", () => ({
  toast: Object.assign(vi.fn(), { success: vi.fn(), error: vi.fn(), warning: vi.fn() }),
  Toaster: () => null,
}));

const { HorsCommerceApprovalCard } = await import("./hors-commerce-approval-card.client");

const ARTWORK = "11111111-1111-4111-8111-111111111111";

describe("HorsCommerceApprovalCard", () => {
  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  it("lets a shop admin approve a proof that is not yet approved", async () => {
    approveHorsCommerce.mockResolvedValue({ ok: true, data: { approvedAt: "x", approvedBy: "y" } });
    render(
      <HorsCommerceApprovalCard
        artworkId={ARTWORK}
        horsCommerce={{ approvedAt: null }}
        canApprove
      />,
    );
    expect(screen.getByText("Needs approval")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Approve for sale" }));
    await waitFor(() =>
      expect(approveHorsCommerce).toHaveBeenCalledWith(
        expect.objectContaining({ artworkId: ARTWORK }),
      ),
    );
  });

  it("tells everyone else that a shop admin has to approve it", () => {
    render(
      <HorsCommerceApprovalCard
        artworkId={ARTWORK}
        horsCommerce={{ approvedAt: null }}
        canApprove={false}
      />,
    );
    expect(screen.getByText(/A shop admin needs to approve it/)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Approve for sale" })).toBeNull();
  });

  it("shows the approval once given", () => {
    render(
      <HorsCommerceApprovalCard
        artworkId={ARTWORK}
        horsCommerce={{ approvedAt: "2026-11-03T10:00:00.000Z" }}
        canApprove
      />,
    );
    expect(screen.getByText("Approved")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Approve for sale" })).toBeNull();
  });
});
