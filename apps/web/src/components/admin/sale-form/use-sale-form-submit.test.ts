import { submitSaleForm } from "@/components/admin/sale-form/use-sale-form-submit";
import { emptyAdminSaleFormValues } from "@/lib/forms/schemas/admin-sale-defaults";
import type { AdminSaleFormValues } from "@/lib/forms/schemas/admin-sale-form";
import type { Lot } from "@auction/types";
import { beforeEach, describe, expect, it, vi } from "vitest";

const adminUpdateSaleResultAction = vi.fn();

vi.mock("@/lib/actions/admin-sales", () => ({
  adminUpdateSaleResultAction: (...args: unknown[]) => adminUpdateSaleResultAction(...args),
}));

vi.mock("@/lib/ui/notify", () => ({
  notify: { success: vi.fn(), error: vi.fn() },
}));

vi.mock("@/lib/admin/admin-form-validation-notify", () => ({
  notifyAdminFormValidationFailure: vi.fn(),
}));

function formStub() {
  return {
    clearErrors: vi.fn(),
    setError: vi.fn(),
  };
}

function baseValues(overrides: Partial<AdminSaleFormValues> = {}): AdminSaleFormValues {
  return {
    ...emptyAdminSaleFormValues(),
    title: "Evening sale",
    startTime: "2030-06-02T10:00",
    endTime: "2030-06-08T18:00",
    ...overrides,
  };
}

function staleLot(overrides: Partial<Lot> = {}): Lot {
  return {
    id: "lot-1",
    saleId: "sale-1",
    lotNumber: 1,
    title: "Blue vase",
    startTime: new Date("2030-06-01T10:00:00Z"),
    endTime: new Date("2030-06-07T18:00:00Z"),
    status: "draft",
    sellerLegalEntityId: "seller-1",
    sellerId: "seller-1",
    categoryId: "c1",
    auctionType: "english",
    startingPrice: "100",
    currentPrice: "100",
    images: [],
    marketingDetails: {},
    ...overrides,
  } as Lot;
}

describe("submitSaleForm schedule persist gate", () => {
  beforeEach(() => {
    adminUpdateSaleResultAction.mockReset();
    adminUpdateSaleResultAction.mockResolvedValue({ ok: true });
  });

  it("allows onsite draft save when lots still reflect the previous window", async () => {
    const onSaveNotice = vi.fn();
    const wizardGoTo = vi.fn();

    await submitSaleForm(baseValues({ deliveryMode: "onsite" }), {
      saleId: "sale-1",
      isDraft: true,
      lots: [staleLot()],
      form: formStub() as never,
      formSchema: {} as never,
      wizardGoTo,
      onSaveNotice,
      router: { push: vi.fn() },
    });

    expect(adminUpdateSaleResultAction).toHaveBeenCalledWith(
      "sale-1",
      expect.objectContaining({
        startTime: expect.any(Date),
        endTime: expect.any(Date),
      }),
    );
    expect(onSaveNotice).not.toHaveBeenCalledWith(expect.stringContaining("Update lot schedules"));
    expect(wizardGoTo).not.toHaveBeenCalled();
  });

  it("allows hybrid draft save when lots still reflect the previous window", async () => {
    const onSaveNotice = vi.fn();
    const wizardGoTo = vi.fn();

    await submitSaleForm(baseValues({ deliveryMode: "hybrid", streamUrl: "https://vimeo.com/1" }), {
      saleId: "sale-1",
      isDraft: true,
      lots: [staleLot()],
      form: formStub() as never,
      formSchema: {} as never,
      wizardGoTo,
      onSaveNotice,
      router: { push: vi.fn() },
    });

    expect(adminUpdateSaleResultAction).toHaveBeenCalled();
    expect(onSaveNotice).not.toHaveBeenCalledWith(expect.stringContaining("Update lot schedules"));
    expect(wizardGoTo).not.toHaveBeenCalled();
  });

  it("blocks online draft save when lots fall outside the pending window", async () => {
    const onSaveNotice = vi.fn();
    const wizardGoTo = vi.fn();

    await submitSaleForm(baseValues({ deliveryMode: "online" }), {
      saleId: "sale-1",
      isDraft: true,
      lots: [staleLot()],
      form: formStub() as never,
      formSchema: {} as never,
      wizardGoTo,
      onSaveNotice,
      router: { push: vi.fn() },
    });

    expect(adminUpdateSaleResultAction).not.toHaveBeenCalled();
    expect(onSaveNotice).toHaveBeenCalledWith(expect.stringContaining("Update lot schedules"));
    expect(wizardGoTo).toHaveBeenCalledWith(1);
  });

  it("skips the persist gate when there are no lots", async () => {
    await submitSaleForm(baseValues({ deliveryMode: "online" }), {
      saleId: "sale-1",
      isDraft: true,
      lots: [],
      form: formStub() as never,
      formSchema: {} as never,
      wizardGoTo: vi.fn(),
      onSaveNotice: vi.fn(),
      router: { push: vi.fn() },
    });

    expect(adminUpdateSaleResultAction).toHaveBeenCalled();
  });
});
