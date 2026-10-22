// @vitest-environment jsdom
import type { MerchandiseProductDetail } from "@auction/shop-contracts";
import { MERCHANDISE_SLUG_IN_USE_MESSAGE } from "@auction/shop-contracts";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const createMerchandiseProduct = vi.fn();
const saveMerchandiseProduct = vi.fn();
const setMerchandiseProductArchived = vi.fn();
const getMerchandiseProductDetail = vi.fn();
const replace = vi.fn();
const refresh = vi.fn();

vi.mock("@/server/application/admin-merchandise-actions.server", () => ({
  createMerchandiseProduct,
  saveMerchandiseProduct,
  setMerchandiseProductArchived,
  getMerchandiseProductDetail,
  addMerchandiseVariant: vi.fn(),
  updateMerchandiseVariant: vi.fn(),
  setMerchandiseVariantArchived: vi.fn(),
  adjustMerchandiseStock: vi.fn(),
}));
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace, refresh }),
  usePathname: () => "/merchandise/p-1",
}));
vi.mock("@auction/ui", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@auction/ui")>()),
  toast: { success: vi.fn() },
}));

const { MerchandiseProductEditor } = await import("./merchandise-product-editor.client");

const OPENED = "2026-03-01T10:00:00.000Z";
const THEIRS = "2026-03-01T11:30:00.000Z";
const MINE = "2026-03-01T11:45:00.000Z";

const detail: MerchandiseProductDetail = {
  productId: "5b1c2d3e-0000-4000-8000-000000000001",
  slug: "tote-bag",
  title: "Tote bag",
  description: "Canvas.",
  status: "active",
  version: OPENED,
  createdAt: OPENED,
  variants: [],
};

function change(label: string, value: string) {
  fireEvent.change(screen.getByLabelText(label), { target: { value } });
}

describe("merchandise product editor", () => {
  beforeEach(() => {
    for (const action of [
      createMerchandiseProduct,
      saveMerchandiseProduct,
      setMerchandiseProductArchived,
      getMerchandiseProductDetail,
      replace,
      refresh,
    ]) {
      action.mockReset();
    }
    saveMerchandiseProduct.mockResolvedValue({ ok: true, data: { version: MINE } });
  });

  describe("saving an existing product", () => {
    it("saves only when asked and sends the version it opened", async () => {
      render(<MerchandiseProductEditor detail={detail} />);
      change("Title", "Canvas tote bag");
      expect(screen.getByText("Unsaved changes")).toBeInTheDocument();
      expect(saveMerchandiseProduct).not.toHaveBeenCalled();

      fireEvent.click(screen.getByRole("button", { name: "Save changes" }));

      await waitFor(() => expect(saveMerchandiseProduct).toHaveBeenCalledTimes(1));
      expect(saveMerchandiseProduct).toHaveBeenCalledWith(
        expect.objectContaining({
          productId: detail.productId,
          expectedVersion: OPENED,
          payload: { title: "Canvas tote bag", slug: "tote-bag", description: "Canvas." },
        }),
      );
      expect(await screen.findByText(/^Saved /)).toBeInTheDocument();
    });

    it("lists field problems and sends nothing", async () => {
      render(<MerchandiseProductEditor detail={detail} />);
      change("Title", "");
      change("Slug", "Tote Bag");
      fireEvent.click(screen.getByRole("button", { name: "Save changes" }));

      const summary = await screen.findByRole("alert");
      expect(within(summary).getByText("Enter a title.")).toBeInTheDocument();
      expect(screen.getByLabelText("Title")).toHaveAttribute("aria-invalid", "true");
      expect(saveMerchandiseProduct).not.toHaveBeenCalled();
    });

    it("shows a taken slug against the slug field", async () => {
      saveMerchandiseProduct.mockResolvedValue({
        ok: false,
        kind: "conflict",
        message: MERCHANDISE_SLUG_IN_USE_MESSAGE,
      });
      render(<MerchandiseProductEditor detail={detail} />);
      change("Slug", "taken");
      fireEvent.click(screen.getByRole("button", { name: "Save changes" }));

      await waitFor(() =>
        expect(screen.getByLabelText("Slug")).toHaveAttribute("aria-invalid", "true"),
      );
      expect(screen.getAllByText(MERCHANDISE_SLUG_IN_USE_MESSAGE).length).toBeGreaterThan(0);
    });
  });

  describe("a save that is out of date", () => {
    beforeEach(() => {
      saveMerchandiseProduct.mockResolvedValueOnce({
        ok: false,
        kind: "conflict",
        message: "changed",
        currentVersion: THEIRS,
      });
    });

    it("offers to reload or keep going instead of overwriting", async () => {
      render(<MerchandiseProductEditor detail={detail} />);
      change("Title", "Mine");
      fireEvent.click(screen.getByRole("button", { name: "Save changes" }));

      expect(await screen.findByText(/Someone else saved this product at/)).toBeInTheDocument();
      expect(saveMerchandiseProduct).toHaveBeenCalledTimes(1);
      expect(screen.getByText("Unsaved changes")).toBeInTheDocument();
    });

    it("saves over theirs only after confirmation, against their version", async () => {
      render(<MerchandiseProductEditor detail={detail} />);
      change("Title", "Mine");
      fireEvent.click(screen.getByRole("button", { name: "Save changes" }));
      await screen.findByText(/Someone else saved this product at/);

      fireEvent.click(screen.getByRole("button", { name: "Keep my changes" }));
      expect(saveMerchandiseProduct).toHaveBeenCalledTimes(1);
      fireEvent.click(await screen.findByRole("button", { name: "Save my version" }));

      await waitFor(() => expect(saveMerchandiseProduct).toHaveBeenCalledTimes(2));
      expect(saveMerchandiseProduct).toHaveBeenLastCalledWith(
        expect.objectContaining({ expectedVersion: THEIRS }),
      );
    });

    it("reloads the stored product and drops the edits after confirmation", async () => {
      getMerchandiseProductDetail.mockResolvedValue({
        ok: true,
        data: { ...detail, title: "Theirs", version: THEIRS },
      });
      render(<MerchandiseProductEditor detail={detail} />);
      change("Title", "Mine");
      fireEvent.click(screen.getByRole("button", { name: "Save changes" }));
      await screen.findByText(/Someone else saved this product at/);

      fireEvent.click(screen.getByRole("button", { name: "Reload" }));
      fireEvent.click(await screen.findByRole("button", { name: "Discard my changes and reload" }));

      await waitFor(() => expect(screen.getByLabelText("Title")).toHaveValue("Theirs"));
      expect(screen.queryByText("Unsaved changes")).not.toBeInTheDocument();
    });
  });

  describe("archiving", () => {
    it("states the consequence and archives only on confirmation", async () => {
      setMerchandiseProductArchived.mockResolvedValue({ ok: true, data: { version: MINE } });
      render(<MerchandiseProductEditor detail={detail} />);

      fireEvent.click(screen.getByRole("button", { name: "Archive product" }));
      const dialog = await screen.findByRole("dialog");
      expect(within(dialog).getByText(/removed from the shop straight away/)).toBeInTheDocument();
      expect(within(dialog).getByText(/nothing is deleted/)).toBeInTheDocument();
      expect(setMerchandiseProductArchived).not.toHaveBeenCalled();

      fireEvent.click(within(dialog).getByRole("button", { name: "Archive product" }));
      await waitFor(() =>
        expect(setMerchandiseProductArchived).toHaveBeenCalledWith(
          expect.objectContaining({ productId: detail.productId, archived: true }),
        ),
      );
      expect(await screen.findByRole("button", { name: "Restore product" })).toBeInTheDocument();
      expect(screen.getByText("Archived")).toBeInTheDocument();
    });

    it("restores without a confirmation", async () => {
      setMerchandiseProductArchived.mockResolvedValue({ ok: true, data: { version: MINE } });
      render(<MerchandiseProductEditor detail={{ ...detail, status: "archived" }} />);
      fireEvent.click(screen.getByRole("button", { name: "Restore product" }));
      await waitFor(() =>
        expect(setMerchandiseProductArchived).toHaveBeenCalledWith(
          expect.objectContaining({ archived: false }),
        ),
      );
    });

    it("asks for a save first when there are unsaved edits", () => {
      render(<MerchandiseProductEditor detail={detail} />);
      change("Title", "Edited");
      expect(screen.getByRole("button", { name: "Archive product" })).toBeDisabled();
    });
  });

  describe("creating a product", () => {
    const fill = () => {
      change("Title", "Canvas tote bag");
      change("SKU", "TOTE-01");
      change("Price (£)", "15");
      change("Opening stock", "4");
    };

    it("suggests a slug from the title until one is typed", () => {
      render(<MerchandiseProductEditor detail={null} />);
      change("Title", "Canvas Tote Bag");
      expect(screen.getByLabelText("Slug")).toHaveValue("canvas-tote-bag");
      change("Slug", "my-tote");
      change("Title", "Canvas Tote Bag 2");
      expect(screen.getByLabelText("Slug")).toHaveValue("my-tote");
    });

    it("creates the product with the price in pence and opens its editor", async () => {
      createMerchandiseProduct.mockResolvedValue({ ok: true, data: { productId: "new-id" } });
      render(<MerchandiseProductEditor detail={null} />);
      fill();
      fireEvent.click(screen.getByRole("button", { name: "Create product" }));

      await waitFor(() => expect(replace).toHaveBeenCalledWith("/merchandise/new-id"));
      expect(createMerchandiseProduct).toHaveBeenCalledWith(
        expect.objectContaining({
          payload: {
            title: "Canvas tote bag",
            slug: "canvas-tote-bag",
            description: null,
            sku: "TOTE-01",
            pricePence: 1500,
            onHand: 4,
          },
        }),
      );
    });

    it("shows a taken SKU against the SKU field", async () => {
      createMerchandiseProduct.mockResolvedValue({
        ok: false,
        kind: "conflict",
        message: "That SKU is already in use.",
      });
      render(<MerchandiseProductEditor detail={null} />);
      fill();
      fireEvent.click(screen.getByRole("button", { name: "Create product" }));
      await waitFor(() =>
        expect(screen.getByLabelText("SKU")).toHaveAttribute("aria-invalid", "true"),
      );
      expect(replace).not.toHaveBeenCalled();
    });

    it("needs the first variant before anything is sent", async () => {
      render(<MerchandiseProductEditor detail={null} />);
      change("Title", "Canvas tote bag");
      fireEvent.click(screen.getByRole("button", { name: "Create product" }));
      expect(await screen.findByRole("alert")).toHaveTextContent("Enter a SKU.");
      expect(createMerchandiseProduct).not.toHaveBeenCalled();
    });
  });
});
