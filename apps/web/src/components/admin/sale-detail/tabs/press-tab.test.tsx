import { SalePressTab } from "@/components/admin/sale-detail/tabs/press-tab";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const adminUpdateSaleResultAction = vi.fn();

vi.mock("@/lib/actions/admin-sales", () => ({
  adminUpdateSaleResultAction: (...args: unknown[]) => adminUpdateSaleResultAction(...args),
}));

// The row menus are Radix popovers, slow in jsdom; they render their actions in place.
vi.mock("@auction/staff-ui", async (importOriginal) =>
  (await import("@/test/inline-row-actions")).withInlineRowActions(
    await importOriginal<typeof import("@auction/staff-ui")>(),
  ),
);

const router = vi.hoisted(() => ({ refresh: () => undefined }));
vi.mock("next/navigation", () => ({ useRouter: () => router }));

vi.mock("@/lib/ui/notify", () => ({
  notify: {
    success: vi.fn(),
    error: vi.fn(),
    warning: vi.fn(),
  },
}));

vi.mock("@/lib/auth/step-up/use-step-up-coordinator", () => ({
  redirectToHostedReauth: vi.fn(),
}));

const FEATURE = {
  url: "https://example.com/feature",
  headline: "Feature story",
  outletName: "Art Daily",
  mentionType: "feature" as const,
  publishedAt: "2026-05-18",
};
const QUOTE = {
  url: "https://example.com/quote",
  headline: "Quoted in review",
  outletName: "Daily Mail",
  mentionType: "quote" as const,
};

describe("SalePressTab", () => {
  afterEach(cleanup);

  beforeEach(() => {
    adminUpdateSaleResultAction.mockReset();
    adminUpdateSaleResultAction.mockResolvedValue({ ok: true });
  });

  it("lists each link with its outlet, type and date, in the saved order", () => {
    render(<SalePressTab saleId="sale-1" initialPressCoverage={[FEATURE, QUOTE]} canManage />);

    const rows = screen.getAllByRole("row").slice(1);
    expect(rows).toHaveLength(2);
    expect(within(rows[0] as HTMLElement).getByText("Feature story")).toBeInTheDocument();
    expect(within(rows[0] as HTMLElement).getByText("Art Daily")).toBeInTheDocument();
    expect(within(rows[0] as HTMLElement).getByText("Feature")).toBeInTheDocument();
    expect(within(rows[0] as HTMLElement).getByText("18 May 2026")).toBeInTheDocument();
    expect(within(rows[1] as HTMLElement).getByText("Quote")).toBeInTheDocument();
  });

  it("explains what appears here when there are no links, and offers the first", () => {
    render(<SalePressTab saleId="sale-1" initialPressCoverage={[]} canManage />);

    expect(screen.getByText("No press links yet")).toBeInTheDocument();
    expect(screen.getAllByText("Add press link").length).toBeGreaterThan(0);
  });

  it("hides every way to change the list from someone who cannot manage it", () => {
    render(<SalePressTab saleId="sale-1" initialPressCoverage={[FEATURE]} canManage={false} />);

    expect(screen.queryByText("Add press link")).toBeNull();
    expect(screen.getAllByText("Open article")[0] as HTMLElement).toBeInTheDocument();
    expect(screen.queryByText("Edit details")).toBeNull();
  });

  it("checks the form on submit, then saves the new link", async () => {
    render(<SalePressTab saleId="sale-1" initialPressCoverage={[]} canManage />);

    fireEvent.click(screen.getAllByText("Add press link")[0] as HTMLElement);
    fireEvent.click(screen.getByText("Add link"));
    expect(screen.getByText("Enter the article's web address.")).toBeInTheDocument();
    expect(adminUpdateSaleResultAction).not.toHaveBeenCalled();

    fireEvent.change(screen.getByLabelText("Article address"), {
      target: { value: "https://example.com/new" },
    });
    expect(screen.queryByText("Enter the article's web address.")).toBeNull();
    fireEvent.change(screen.getByLabelText("Outlet"), { target: { value: "The Times" } });
    fireEvent.change(screen.getByLabelText("Headline"), { target: { value: "New story" } });
    fireEvent.click(screen.getByText("Add link"));

    await waitFor(() => {
      expect(adminUpdateSaleResultAction).toHaveBeenCalledWith("sale-1", {
        pressCoverage: [
          {
            url: "https://example.com/new",
            headline: "New story",
            outletName: "The Times",
          },
        ],
      });
    });
  });

  it("keeps a failed save in the dialog with what was typed", async () => {
    adminUpdateSaleResultAction.mockResolvedValue({ ok: false, error: "Save is unavailable." });
    render(<SalePressTab saleId="sale-1" initialPressCoverage={[FEATURE]} canManage />);

    fireEvent.click(screen.getAllByText("Edit details")[0] as HTMLElement);
    fireEvent.change(screen.getByLabelText("Headline"), { target: { value: "Changed headline" } });
    fireEvent.click(screen.getByText("Save changes"));

    expect(await screen.findByText("Save is unavailable.")).toBeInTheDocument();
    expect(screen.getByLabelText("Headline")).toHaveValue("Changed headline");
  });

  it("removes a link only after it is confirmed", async () => {
    render(<SalePressTab saleId="sale-1" initialPressCoverage={[FEATURE, QUOTE]} canManage />);

    fireEvent.click(screen.getAllByText("Remove link…")[0] as HTMLElement);
    expect(screen.getByText("Remove this press link?")).toBeInTheDocument();
    expect(adminUpdateSaleResultAction).not.toHaveBeenCalled();

    fireEvent.click(screen.getByText("Remove link"));

    await waitFor(() => {
      expect(adminUpdateSaleResultAction).toHaveBeenCalledWith("sale-1", {
        pressCoverage: [expect.objectContaining({ headline: "Quoted in review" })],
      });
    });
  });

  it("moves a link down and saves the new order", async () => {
    render(<SalePressTab saleId="sale-1" initialPressCoverage={[FEATURE, QUOTE]} canManage />);

    fireEvent.click(screen.getAllByText("Move down")[0] as HTMLElement);

    await waitFor(() => {
      expect(adminUpdateSaleResultAction).toHaveBeenCalledWith("sale-1", {
        pressCoverage: [
          expect.objectContaining({ headline: "Quoted in review" }),
          expect.objectContaining({ headline: "Feature story" }),
        ],
      });
    });
  });
});
