// @vitest-environment jsdom
import type { MerchandiseVariantDetail } from "@auction/shop-contracts";
import { MERCHANDISE_SKU_IN_USE_MESSAGE } from "@auction/shop-contracts";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const addMerchandiseVariant = vi.fn();
const updateMerchandiseVariant = vi.fn();
const setMerchandiseVariantArchived = vi.fn();
const adjustMerchandiseStock = vi.fn();
const refresh = vi.fn();

vi.mock("@/server/application/admin-merchandise-actions.server", () => ({
  addMerchandiseVariant,
  updateMerchandiseVariant,
  setMerchandiseVariantArchived,
  adjustMerchandiseStock,
}));
vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh }),
  usePathname: () => "/merchandise/p-1",
}));
vi.mock("@auction/ui", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@auction/ui")>()),
  toast: { success: vi.fn() },
}));

const { MerchandiseVariants } = await import("./merchandise-variants.client");

const PRODUCT = "5b1c2d3e-0000-4000-8000-000000000001";
const variant: MerchandiseVariantDetail = {
  variantId: "5b1c2d3e-0000-4000-8000-000000000002",
  sku: "TOTE-01",
  pricePence: 1500,
  onHand: 6,
  reserved: 2,
  status: "active",
};

function renderVariants(variants: MerchandiseVariantDetail[] = [variant]) {
  return render(<MerchandiseVariants productId={PRODUCT} variants={variants} />);
}

function change(label: string, value: string) {
  fireEvent.change(screen.getByLabelText(label), { target: { value } });
}

describe("merchandise variants", () => {
  beforeEach(() => {
    for (const action of [
      addMerchandiseVariant,
      updateMerchandiseVariant,
      setMerchandiseVariantArchived,
      adjustMerchandiseStock,
      refresh,
    ]) {
      action.mockReset();
      action.mockResolvedValue({ ok: true, data: {} });
    }
  });

  it("lists each variant with price, stock and what is held for checkouts", () => {
    renderVariants();
    const row = screen.getByRole("row", { name: /TOTE-01/ });
    expect(within(row).getByText("£15.00")).toBeInTheDocument();
    expect(within(row).getByText("6")).toBeInTheDocument();
    expect(within(row).getByText("2")).toBeInTheDocument();
  });

  it("explains an empty list and offers the way forward", () => {
    renderVariants([]);
    expect(screen.getByText("No variants")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Add variant" })).toBeInTheDocument();
  });

  describe("adding", () => {
    it("sends the price in pence", async () => {
      renderVariants();
      fireEvent.click(screen.getByRole("button", { name: "Add variant" }));
      const dialog = await screen.findByRole("dialog");
      change("SKU", "TOTE-02");
      change("Price (£)", "18.50");
      fireEvent.click(within(dialog).getByRole("button", { name: "Add variant" }));

      await waitFor(() =>
        expect(addMerchandiseVariant).toHaveBeenCalledWith(
          expect.objectContaining({
            productId: PRODUCT,
            payload: { sku: "TOTE-02", pricePence: 1850 },
          }),
        ),
      );
      await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    });

    it("keeps the dialog open and names the problem when the form is incomplete", async () => {
      renderVariants();
      fireEvent.click(screen.getByRole("button", { name: "Add variant" }));
      const dialog = await screen.findByRole("dialog");
      fireEvent.click(within(dialog).getByRole("button", { name: "Add variant" }));

      expect(await within(dialog).findByRole("alert")).toHaveTextContent("Enter a SKU.");
      expect(addMerchandiseVariant).not.toHaveBeenCalled();
    });

    it("shows a taken SKU against the SKU field and stays open", async () => {
      addMerchandiseVariant.mockResolvedValue({
        ok: false,
        kind: "conflict",
        message: MERCHANDISE_SKU_IN_USE_MESSAGE,
      });
      renderVariants();
      fireEvent.click(screen.getByRole("button", { name: "Add variant" }));
      const dialog = await screen.findByRole("dialog");
      change("SKU", "TOTE-01");
      change("Price (£)", "10");
      fireEvent.click(within(dialog).getByRole("button", { name: "Add variant" }));

      await waitFor(() =>
        expect(within(dialog).getByLabelText("SKU")).toHaveAttribute("aria-invalid", "true"),
      );
      expect(screen.getByRole("dialog")).toBeInTheDocument();
    });
  });

  describe("editing", () => {
    it("starts from the saved SKU and price", async () => {
      renderVariants();
      fireEvent.click(screen.getByRole("button", { name: /Edit/ }));
      await screen.findByRole("dialog");
      expect(screen.getByLabelText("SKU")).toHaveValue("TOTE-01");
      expect(screen.getByLabelText("Price (£)")).toHaveValue("15.00");
    });
  });

  describe("adjusting stock", () => {
    async function openStock() {
      renderVariants();
      fireEvent.click(screen.getByRole("button", { name: /Adjust stock/ }));
      return screen.findByRole("dialog");
    }

    it("requires a reason", async () => {
      const dialog = await openStock();
      change("On hand", "9");
      fireEvent.click(within(dialog).getByRole("button", { name: "Update stock" }));
      expect(await within(dialog).findByRole("alert")).toHaveTextContent(/reason/);
      expect(adjustMerchandiseStock).not.toHaveBeenCalled();
    });

    it("refuses a count below the units held for checkouts", async () => {
      const dialog = await openStock();
      change("On hand", "1");
      change("Reason", "Recount");
      fireEvent.click(within(dialog).getByRole("button", { name: "Update stock" }));
      expect(await within(dialog).findByRole("alert")).toHaveTextContent("2 units are held");
      expect(adjustMerchandiseStock).not.toHaveBeenCalled();
    });

    it("sends the count with its reason", async () => {
      const dialog = await openStock();
      change("On hand", "9");
      change("Reason", "Recount after delivery");
      fireEvent.click(within(dialog).getByRole("button", { name: "Update stock" }));
      await waitFor(() =>
        expect(adjustMerchandiseStock).toHaveBeenCalledWith(
          expect.objectContaining({
            variantId: variant.variantId,
            payload: { onHand: 9, reason: "Recount after delivery" },
          }),
        ),
      );
    });
  });

  describe("archiving", () => {
    it("states the consequence and archives only on confirmation", async () => {
      renderVariants();
      fireEvent.click(screen.getByRole("button", { name: /Archive/ }));
      const dialog = await screen.findByRole("dialog");
      expect(within(dialog).getByText(/stops being sold straight away/)).toBeInTheDocument();
      expect(setMerchandiseVariantArchived).not.toHaveBeenCalled();

      fireEvent.click(within(dialog).getByRole("button", { name: "Archive variant" }));
      await waitFor(() =>
        expect(setMerchandiseVariantArchived).toHaveBeenCalledWith(
          expect.objectContaining({ variantId: variant.variantId, archived: true }),
        ),
      );
    });

    it("restores an archived variant straight away", async () => {
      renderVariants([{ ...variant, status: "archived" }]);
      expect(screen.getByText("Archived")).toBeInTheDocument();
      fireEvent.click(screen.getByRole("button", { name: /Restore/ }));
      await waitFor(() =>
        expect(setMerchandiseVariantArchived).toHaveBeenCalledWith(
          expect.objectContaining({ archived: false }),
        ),
      );
    });
  });
});
