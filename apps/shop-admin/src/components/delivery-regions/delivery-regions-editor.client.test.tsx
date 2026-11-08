// @vitest-environment jsdom
import type { AdminDeliveryRegions } from "@auction/shop-contracts";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@auction/ui/components/popover", async () =>
  (await import("@/test/radix-stubs")).popoverStub(),
);
vi.mock("@auction/ui/components/tooltip", async () =>
  (await import("@/test/radix-stubs")).tooltipStub(),
);
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), refresh: vi.fn() }),
  usePathname: () => "/settings/delivery-regions",
}));
const { toastSuccess } = vi.hoisted(() => ({ toastSuccess: vi.fn() }));
vi.mock("sonner", () => ({
  toast: Object.assign(vi.fn(), { success: toastSuccess, error: vi.fn(), warning: vi.fn() }),
  Toaster: () => null,
}));

(await import("@/test/radix-stubs")).installLayoutStubs();
const { DeliveryRegionsEditor } = await import("./delivery-regions-editor.client");

const data: AdminDeliveryRegions = {
  regions: [
    {
      id: "uk",
      name: "United Kingdom",
      standard: { minDays: 5, maxDays: 10 },
      specialist: { minDays: 10, maxDays: 20 },
      fixedPricePence: 1500,
      countries: ["GB"],
    },
    {
      id: "eu",
      name: "European Union",
      standard: { minDays: 10, maxDays: 15 },
      specialist: { minDays: 15, maxDays: 25 },
      fixedPricePence: null,
      countries: ["DE", "FR"],
    },
  ],
  notDeliveredTo: [
    { code: "RU", name: "Russia" },
    { code: "SY", name: "Syria" },
  ],
  countryChoices: [
    { code: "AF", name: "Afghanistan" },
    { code: "RU", name: "Russia" },
    { code: "SY", name: "Syria" },
  ],
};

const saveRegion = vi.fn();
const saveCountries = vi.fn();
const actions = { saveRegion, saveCountries } as never;

beforeEach(() => {
  saveRegion.mockReset();
  saveCountries.mockReset();
  toastSuccess.mockReset();
});

describe("DeliveryRegionsEditor", () => {
  it("shows the regions, everywhere else as a quote, and the countries not delivered to", () => {
    render(<DeliveryRegionsEditor initial={data} canEdit={false} actions={actions} />);
    expect(screen.getAllByText("European Union").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Everywhere else").length).toBeGreaterThan(0);
    expect(screen.getByText("Russia, Syria")).toBeTruthy();
  });

  it("offers no edit buttons without settings.write", () => {
    render(<DeliveryRegionsEditor initial={data} canEdit={false} actions={actions} />);
    expect(screen.queryByRole("button", { name: /edit/i })).toBeNull();
  });

  it("saves a region and shows the result", async () => {
    saveRegion.mockResolvedValue({
      ok: true,
      data: {
        ...data,
        regions: [data.regions[0], { ...data.regions[1], standard: { minDays: 8, maxDays: 12 } }],
      },
    });
    render(<DeliveryRegionsEditor initial={data} canEdit actions={actions} />);
    fireEvent.click(
      screen.getAllByRole("button", { name: "Edit European Union" })[0] as HTMLElement,
    );
    const dialog = await screen.findByRole("dialog");
    const shortest = within(dialog).getAllByLabelText("Shortest, days")[0] as HTMLInputElement;
    fireEvent.change(shortest, { target: { value: "8" } });
    const longest = within(dialog).getAllByLabelText("Longest, days")[0] as HTMLInputElement;
    fireEvent.change(longest, { target: { value: "12" } });
    fireEvent.click(within(dialog).getByRole("button", { name: "Save region" }));
    await waitFor(() => expect(saveRegion).toHaveBeenCalledTimes(1));
    expect(saveRegion.mock.calls[0]?.[0]).toMatchObject({
      id: "eu",
      standardMinDays: 8,
      standardMaxDays: 12,
      fixedPricePence: null,
    });
    await waitFor(() => expect(screen.getAllByText("8 to 12").length).toBeGreaterThan(0));
  });

  it("summarises two problems and marks each field, sending nothing", async () => {
    render(<DeliveryRegionsEditor initial={data} canEdit actions={actions} />);
    fireEvent.click(
      screen.getAllByRole("button", { name: "Edit European Union" })[0] as HTMLElement,
    );
    const dialog = await screen.findByRole("dialog");
    fireEvent.change(within(dialog).getAllByLabelText("Shortest, days")[0] as HTMLInputElement, {
      target: { value: "" },
    });
    fireEvent.change(within(dialog).getAllByLabelText("Longest, days")[1] as HTMLInputElement, {
      target: { value: "" },
    });
    fireEvent.click(within(dialog).getByRole("button", { name: "Save region" }));
    const summary = await within(dialog).findByText("There is a problem");
    expect(summary).toBeTruthy();
    expect(
      within(dialog).getAllByText("Enter the number of working days").length,
    ).toBeGreaterThanOrEqual(2);
    expect(saveRegion).not.toHaveBeenCalled();
  });

  it("locks the UK's price", async () => {
    render(<DeliveryRegionsEditor initial={data} canEdit actions={actions} />);
    fireEvent.click(
      screen.getAllByRole("button", { name: "Edit United Kingdom" })[0] as HTMLElement,
    );
    const dialog = await screen.findByRole("dialog");
    expect(within(dialog).getByText(/charged at its fixed price in checkout/)).toBeTruthy();
    expect(within(dialog).queryByRole("radio")).toBeNull();
  });

  it("saves an emptied country list", async () => {
    saveCountries.mockResolvedValue({ ok: true, data: { ...data, notDeliveredTo: [] } });
    render(<DeliveryRegionsEditor initial={data} canEdit actions={actions} />);
    fireEvent.click(screen.getByRole("button", { name: "Edit countries" }));
    const dialog = await screen.findByRole("dialog");
    fireEvent.click(within(dialog).getByRole("button", { name: "Remove Russia" }));
    fireEvent.click(within(dialog).getByRole("button", { name: "Remove Syria" }));
    fireEvent.click(within(dialog).getByRole("button", { name: "Save countries" }));
    await waitFor(() => expect(saveCountries).toHaveBeenCalledTimes(1));
    expect(saveCountries.mock.calls[0]?.[0]).toMatchObject({ countries: [] });
    await waitFor(() =>
      expect(screen.getByText("No countries. Every country can be quoted.")).toBeTruthy(),
    );
  });
});
