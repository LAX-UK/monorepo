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

  it("renders mention-type placeholder in the press grid", () => {
    renderWithViewer(
      <SalePressTab
        saleId="sale-1"
        initialPressCoverage={[
          {
            url: "https://example.com/quote",
            headline: "Quoted in review",
            outletName: "Art Daily",
            mentionType: "quote",
            publishedAt: "2026-05-18",
          },
        ]}
        canManage={false}
      />,
    );

    expect(screen.getByRole("img", { name: /Art Daily press coverage placeholder/i })).toBeTruthy();
    expect(screen.getByText(/18 May 2026/)).toBeInTheDocument();
    expect(screen.getByText("Quote")).toBeInTheDocument();
  });

  it("edits press metadata in the inspector and saves from the dirty bar", async () => {
    renderWithViewer(
      <SalePressTab
        saleId="sale-1"
        initialPressCoverage={[
          {
            url: "https://example.com/article",
            headline: "Feature story",
            outletName: "Art Daily",
            mentionType: "feature",
          },
        ]}
        canManage
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Edit details" }));
    fireEvent.change(screen.getByLabelText("Headline"), {
      target: { value: "Updated feature story" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Save coverage" }));

    await waitFor(() => {
      expect(adminUpdateSaleResultAction).toHaveBeenCalledWith("sale-1", {
        pressCoverage: [
          expect.objectContaining({
            headline: "Updated feature story",
            outletName: "Art Daily",
          }),
        ],
      });
    });
  });

  it("persists removal after confirm from manage mode", async () => {
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

    fireEvent.click(screen.getByRole("button", { name: "Manage" }));
    fireEvent.click(screen.getByRole("button", { name: "Remove press link" }));
    expect(screen.getByText("Remove press link?")).toBeInTheDocument();
    expect(adminUpdateSaleResultAction).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole("button", { name: "Remove" }));

    await waitFor(() => {
      expect(adminUpdateSaleResultAction).toHaveBeenCalledWith("sale-1", { pressCoverage: [] });
    });
  });
});
