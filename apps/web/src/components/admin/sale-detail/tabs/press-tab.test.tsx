import { SalePressTab } from "@/components/admin/sale-detail/tabs/press-tab";
import { renderWithViewer } from "@/test/render-with-viewer";
import { fireEvent, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const adminUpdateSaleResultAction = vi.fn();

vi.mock("@/lib/actions/admin-sales", () => ({
  adminUpdateSaleResultAction: (...args: unknown[]) => adminUpdateSaleResultAction(...args),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: vi.fn() }),
}));

vi.mock("@/lib/ui/notify", () => ({
  notify: {
    success: vi.fn(),
    error: vi.fn(),
    warning: vi.fn(),
  },
}));

describe("SalePressTab remove", () => {
  beforeEach(() => {
    adminUpdateSaleResultAction.mockReset();
    adminUpdateSaleResultAction.mockResolvedValue({ ok: true });
  });

  it("persists removal after confirm", async () => {
    renderWithViewer(
      <SalePressTab
        saleId="sale-1"
        initialPressCoverage={[
          {
            url: "https://example.com/article",
            headline: "Feature story",
            outletName: "Daily Mail",
          },
        ]}
        canManage
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Remove press link" }));
    expect(screen.getByText("Remove press link?")).toBeInTheDocument();
    expect(adminUpdateSaleResultAction).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole("button", { name: "Remove" }));

    await waitFor(() => {
      expect(adminUpdateSaleResultAction).toHaveBeenCalledWith("sale-1", { pressCoverage: [] });
    });
  });
});
